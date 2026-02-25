# Migration Guide: Comprehensive Registration + Automated Workflow System

**Source Project**: parkingrx.com (Handicap Parking Permit Services)
**Date**: February 25, 2026

## What This Guide Covers

This guide documents all changes made to convert the white-label base project into a fully automated permit application platform. Another AI agent can follow these instructions line-for-line to replicate the same system on a copy of this project.

### What You'll Need to Customize Per Project
Throughout this guide, replace these project-specific terms:
- `"Handicap Permit Services"` → Your project's service name
- `"handicap parking permit"` → Your project's service type
- `"parkingrx.com"` → Your project's domain
- `"noreply@parkingrx.com"` → Your project's from-email address
- `"admin@parkingrx.com"` → Your project's admin email placeholder
- `"Oklahoma Forms 302DC and 750-C"` → Your state's specific form references
- Any state-specific form field descriptions

---

## CHANGE 1: Extended Registration Form (Register.tsx)

### WHY
The original Register.tsx only collected email, password, first name, last name, and phone. The new version collects ALL information upfront — personal details, full address, medical info, driver's license, SSN, veteran/Medicare status, and 4 required consent checkboxes — so the user's profile is complete from day one and auto-fills into applications.

### HOW IT WORKS
- Google sign-up is removed to enforce complete data collection
- A Zod schema validates every field with appropriate rules
- 4 consent checkboxes use `.refine(val => val === true, ...)` to make them mandatory
- `onSubmit` passes ALL fields to the `register()` function from AuthContext
- On success, user is redirected to their dashboard with a fully populated profile

### FULL FILE: `client/src/pages/Register.tsx`

```tsx
import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
];

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  address: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP code is required"),
  medicalCondition: z.string().optional(),
  driverLicenseNumber: z.string().optional(),
  hasMedicare: z.boolean().default(false),
  ssn: z.string().optional(),
  isVeteran: z.boolean().default(false),
  referralCode: z.string().optional(),
  smsConsent: z.boolean().refine(val => val === true, { message: "SMS consent is required to use our services" }),
  emailConsent: z.boolean().refine(val => val === true, { message: "Email consent is required to use our services" }),
  chargeUnderstanding: z.boolean().refine(val => val === true, { message: "You must acknowledge the charge information" }),
  patientAuthorization: z.boolean().refine(val => val === true, { message: "Authorization is required" }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const { register } = useAuth();
  const { config } = useConfig();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const referralCode = params.get("ref") || "";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      middleName: "",
      lastName: "",
      phone: "",
      dateOfBirth: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      medicalCondition: "",
      driverLicenseNumber: "",
      hasMedicare: false,
      ssn: "",
      isVeteran: false,
      referralCode: referralCode,
      smsConsent: false,
      emailConsent: false,
      chargeUnderstanding: false,
      patientAuthorization: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      await register({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        middleName: data.middleName,
        dateOfBirth: data.dateOfBirth,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        driverLicenseNumber: data.driverLicenseNumber,
        medicalCondition: data.medicalCondition,
        ssn: data.ssn,
        hasMedicare: data.hasMedicare,
        isVeteran: data.isVeteran,
        referralCode: data.referralCode,
        smsConsent: data.smsConsent,
        emailConsent: data.emailConsent,
        chargeUnderstanding: data.chargeUnderstanding,
        patientAuthorization: data.patientAuthorization,
      });
      toast({
        title: "Account created!",
        description: "Welcome! Your account has been created successfully.",
      });
      setLocation("/dashboard/applicant");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // RENDER: The form renders these sections in order:
  // 1. Account Information (email, password, confirm password)
  // 2. Personal Information (firstName, middleName, lastName, phone, dateOfBirth)
  // 3. Address Information (address, city, state dropdown, zipCode)
  //    - Includes P.O. Box warning: "Please verify your address does not have a P.O. Box. You WILL BE DENIED if you use a P.O. Box."
  // 4. Medical Information (Optional) (medicalCondition textarea, driverLicenseNumber, hasMedicare checkbox, ssn, isVeteran checkbox)
  // 5. Referral Code (Optional) (referralCode)
  // 6. Communication Consent (Required) - 4 checkboxes:
  //    - smsConsent: "I consent to receive text messages (SMS/MMS)..."
  //    - emailConsent: "I consent to receive email communications..."
  //    - chargeUnderstanding: "I understand there is a charge for this service..."
  //    - patientAuthorization: "I authorize the collection and use of my personal/medical information..."
  // 7. Submit button + "Already have an account?" link

  return (
    // ... full JSX as shown in the existing Register.tsx file
    // The form uses the same pattern for every field:
    // <FormField control={form.control} name="fieldName" render={...} />
    // State dropdown uses <Select> with US_STATES array
    // Checkboxes use <Checkbox checked={field.value} onCheckedChange={field.onChange} />
    // All required fields show <span className="text-destructive">*</span> in their label
  );
}
```

### KEY PATTERNS USED IN THE FORM

**State dropdown:**
```tsx
<FormField
  control={form.control}
  name="state"
  render={({ field }) => (
    <FormItem>
      <FormLabel>State <span className="text-destructive">*</span></FormLabel>
      <Select onValueChange={field.onChange} value={field.value}>
        <FormControl>
          <SelectTrigger data-testid="select-state">
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {US_STATES.map((st) => (
            <SelectItem key={st} value={st}>{st}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Required consent checkbox:**
```tsx
<FormField
  control={form.control}
  name="smsConsent"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
      <FormControl>
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
          data-testid="checkbox-sms-consent"
        />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>SMS/Text Message Consent <span className="text-destructive">*</span></FormLabel>
        <FormDescription>
          I consent to receive text messages (SMS/MMS) at the phone number provided...
        </FormDescription>
      </div>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## CHANGE 2: Extended RegisterData Interface (AuthContext.tsx)

### WHY
The AuthContext's `register()` function needs to accept and pass through all the new fields.

### WHAT TO CHANGE
Find the `RegisterData` interface in `client/src/contexts/AuthContext.tsx` and replace it:

```tsx
interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  referralCode?: string;
  middleName?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  driverLicenseNumber?: string;
  medicalCondition?: string;
  ssn?: string;
  hasMedicare?: boolean;
  isVeteran?: boolean;
  smsConsent?: boolean;
  emailConsent?: boolean;
  chargeUnderstanding?: boolean;
  patientAuthorization?: boolean;
}
```

### HOW THE REGISTER FUNCTION WORKS
The `register` function in AuthContext:
1. Creates a Firebase Auth user with email/password (non-blocking if it fails)
2. Sends ALL fields + `firebaseUid` to `POST /api/auth/register`
3. Sets the returned user in state

```tsx
const register = async (data: RegisterData): Promise<User> => {
  setLoading(true);
  try {
    let firebaseUid: string | undefined;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      firebaseUid = userCredential.user.uid;
    } catch (fbError: any) {
      console.warn("Firebase Auth registration skipped:", fbError.message);
    }

    const response = await apiRequest("POST", "/api/auth/register", {
      ...data,
      firebaseUid,
    });
    const result = await response.json();
    setUser(result.user);
    return result.user;
  } finally {
    setLoading(false);
  }
};
```

---

## CHANGE 3: Extended Registration Endpoint (server/routes.ts — POST /api/auth/register)

### WHY
The backend needs to accept, validate, and store all the new fields when creating a user.

### WHAT TO CHANGE
Find `app.post("/api/auth/register", ...)` in `server/routes.ts` and replace the handler:

```typescript
app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      email, password, firstName, lastName, phone, referralCode, firebaseUid,
      middleName, dateOfBirth, address, city, state, zipCode,
      driverLicenseNumber, medicalCondition, ssn,
      hasMedicare, isVeteran,
      smsConsent, emailConsent, chargeUnderstanding, patientAuthorization
    } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      res.status(400).json({ message: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const profileId = randomBytes(4).toString("hex").toUpperCase();
    const userReferralCode = randomBytes(4).toString("hex").toUpperCase();

    let referredByUserId: string | undefined;
    if (referralCode) {
      const referrer = await storage.getUserByReferralCode(referralCode);
      if (referrer) {
        referredByUserId = referrer.id;
      }
    }

    // Compute whether registration is complete based on all required fields + consents
    const registrationComplete = !!(firstName && lastName && phone && dateOfBirth && address && city && state && zipCode && smsConsent && emailConsent && chargeUnderstanding && patientAuthorization);

    const userData: any = {
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      firebaseUid: firebaseUid || null,
      userLevel: 1,
      profileId,
      referralCode: userReferralCode,
      referredByUserId,
      isActive: true,
      registrationComplete,
    };

    // Conditionally add optional/extended fields (only if provided)
    if (middleName) userData.middleName = middleName;
    if (dateOfBirth) userData.dateOfBirth = dateOfBirth;
    if (address) userData.address = address;
    if (city) userData.city = city;
    if (state) userData.state = state;
    if (zipCode) userData.zipCode = zipCode;
    if (driverLicenseNumber) userData.driverLicenseNumber = driverLicenseNumber;
    if (medicalCondition) userData.medicalCondition = medicalCondition;
    if (ssn) userData.ssn = ssn;
    if (hasMedicare !== undefined) userData.hasMedicare = hasMedicare;
    if (isVeteran !== undefined) userData.isVeteran = isVeteran;
    if (smsConsent !== undefined) userData.smsConsent = smsConsent;
    if (emailConsent !== undefined) userData.emailConsent = emailConsent;
    if (chargeUnderstanding !== undefined) userData.chargeUnderstanding = chargeUnderstanding;
    if (patientAuthorization !== undefined) userData.patientAuthorization = patientAuthorization;

    const user = await storage.createUser(userData);

    await storage.createActivityLog({
      userId: user.id,
      action: "user_registered",
      entityType: "user",
      entityId: user.id,
      details: { referredBy: referralCode || null },
    });

    res.json({
      user: {
        ...user,
        passwordHash: undefined,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

### HOW FIRESTORE STORES THESE FIELDS
Since Firestore is schemaless, no migration is needed. The `storage.createUser()` method passes the userData object through `cleanForFirestore()` (which strips `undefined` values) and writes it directly to the `users` collection. Every field becomes a top-level field on the user document.

---

## CHANGE 4: Profile API Endpoints (server/routes.ts)

### WHY
Users need to view and update their full profile after registration. The RegistrationPage and NewApplication page both depend on these endpoints.

### WHAT TO ADD
Add these two routes after your existing auth routes in `server/routes.ts`:

```typescript
// ===========================================================================
// PROFILE ROUTES (Self-service profile for applicants)
// ===========================================================================

app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ ...user, passwordHash: undefined });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/profile", requireAuth, async (req, res) => {
  try {
    const {
      firstName, middleName, lastName, phone, dateOfBirth,
      address, city, state, zipCode,
      driverLicenseNumber, medicalCondition, ssn,
      hasMedicare, isVeteran,
      smsConsent, emailConsent, chargeUnderstanding, patientAuthorization,
      registrationComplete, referralCode
    } = req.body;

    const updates: Record<string, any> = {};

    if (firstName !== undefined) updates.firstName = firstName;
    if (middleName !== undefined) updates.middleName = middleName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (phone !== undefined) updates.phone = phone;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (zipCode !== undefined) updates.zipCode = zipCode;
    if (driverLicenseNumber !== undefined) updates.driverLicenseNumber = driverLicenseNumber;
    if (medicalCondition !== undefined) updates.medicalCondition = medicalCondition;
    if (ssn !== undefined) updates.ssn = ssn;
    if (hasMedicare !== undefined) updates.hasMedicare = hasMedicare;
    if (isVeteran !== undefined) updates.isVeteran = isVeteran;
    if (smsConsent !== undefined) updates.smsConsent = smsConsent;
    if (emailConsent !== undefined) updates.emailConsent = emailConsent;
    if (chargeUnderstanding !== undefined) updates.chargeUnderstanding = chargeUnderstanding;
    if (patientAuthorization !== undefined) updates.patientAuthorization = patientAuthorization;
    if (registrationComplete !== undefined) updates.registrationComplete = registrationComplete;
    if (referralCode !== undefined) updates.referralCode = referralCode;

    const user = await storage.updateUser(req.user!.id, updates as any);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ ...user, passwordHash: undefined });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

---

## CHANGE 5: Profile/Registration Page (RegistrationPage.tsx)

### WHY
This is the dashboard page where logged-in users can view and update their full profile. It shows a green banner when complete, amber when incomplete, and disables the "Apply for Permit" button until everything is filled in.

### HOW IT WORKS
1. Fetches profile from `GET /api/profile` via TanStack Query
2. `isProfileComplete()` checks 12 fields (8 personal/address + 4 consents)
3. `useEffect` resets the form with loaded profile data
4. `onSubmit` sends `PUT /api/profile` with `registrationComplete: true`
5. Profile completeness banner uses green (`CheckCircle2`) or amber (`AlertCircle`) Alert

### PROFILE COMPLETENESS CHECK (used in both RegistrationPage and NewApplication)

```typescript
function isProfileComplete(data: any): boolean {
  return !!(
    data?.firstName &&
    data?.lastName &&
    data?.phone &&
    data?.dateOfBirth &&
    data?.address &&
    data?.city &&
    data?.state &&
    data?.zipCode &&
    data?.smsConsent &&
    data?.emailConsent &&
    data?.chargeUnderstanding &&
    data?.patientAuthorization
  );
}
```

### FULL FILE: `client/src/pages/dashboard/applicant/RegistrationPage.tsx`

The file structure:
- Same Zod schema as Register.tsx (minus password/confirmPassword, plus email as read-only)
- `useQuery` fetches `GET /api/profile`
- `useEffect` populates form when profile loads
- `onSubmit` calls `PUT /api/profile` via `apiRequest`
- Green/amber status banner at top
- Same form sections as Register.tsx (Personal, Address, Medical, Referral, Consents)
- "Apply for Permit" button disabled when profile incomplete

```tsx
// KEY DIFFERENCES FROM Register.tsx:
// 1. Email field is DISABLED (read-only, shows current email)
// 2. No password fields
// 3. Uses DashboardLayout wrapper
// 4. Fetches existing data from GET /api/profile on mount
// 5. Saves via PUT /api/profile instead of POST /api/auth/register
// 6. Shows completeness banner (green = complete, amber = incomplete)
// 7. "Apply for Permit" button links to /packages, disabled when incomplete

const onSubmit = async (data: RegistrationFormData) => {
  setIsSaving(true);
  try {
    const { email, ...profileData } = data;
    await apiRequest("PUT", "/api/profile", {
      ...profileData,
      registrationComplete: true,
    });
    await refreshUser();
    toast({
      title: "Profile Saved",
      description: "Your profile information has been saved successfully.",
    });
  } catch (error: any) {
    toast({
      title: "Save Failed",
      description: error.message || "Could not save your profile. Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsSaving(false);
  }
};
```

---

## CHANGE 6: Auto-Fill Application from Profile (NewApplication.tsx)

### WHY
When a user creates a new application, ALL their profile data should auto-fill into the application form data — so the doctor sees everything without the user re-entering it. The page also gates access: if the profile is incomplete, it blocks the application and redirects to the profile page.

### HOW IT WORKS
1. Fetches profile from `GET /api/profile`
2. If `isProfileComplete(profile)` is false → shows "Complete Your Profile First" with a link to `/dashboard/applicant/registration`
3. If complete → shows 3-step wizard:
   - Step 1: Select Permit Type (radio buttons for packages)
   - Step 2: Review auto-filled profile info + enter reason for permit + package-specific custom fields
   - Step 3: Final review & submit
4. On submit, ALL profile fields are merged into `formData`:

```typescript
const createApplication = useMutation({
  mutationFn: async (data: ApplicationFormData) => {
    const fullName = [profile?.firstName, profile?.middleName, profile?.lastName].filter(Boolean).join(" ");
    const formData = {
      ...data,
      ...customFields,         // package-specific dynamic fields
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
      medicalCondition: profile?.medicalCondition,
      ssn: profile?.ssn,
      hasMedicare: profile?.hasMedicare,
      isVeteran: profile?.isVeteran,
    };
    const response = await apiRequest("POST", "/api/applications", {
      packageId: data.packageId,
      formData,
      autoSendToDoctor: true,  // triggers auto-assignment on creation
    });
    return response.json();
  },
  // ...
});
```

### PROFILE GATE (shown when profile is incomplete)

```tsx
if (!profileComplete) {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Please complete your profile before applying for a permit.
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Profile First</CardTitle>
            <CardDescription>
              Your profile information will be used on your medical forms and permit application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/applicant/registration">
              <Button className="w-full" data-testid="button-complete-profile">
                <User className="mr-2 h-4 w-4" />
                Complete My Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
```

### STEP 2: REVIEW INFO + PACKAGE-SPECIFIC CUSTOM FIELDS

Step 2 shows the auto-filled profile data in a read-only summary, then renders any package-specific form fields defined by the admin:

```tsx
{/* Auto-filled profile review */}
<Card data-testid="step-review-info">
  <CardHeader>
    <CardTitle>Your Information</CardTitle>
    <CardDescription>
      This information is pulled from your profile and will be used on your permit application
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Full Name</p>
        <p className="font-medium">{fullName}</p>
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">Email</p>
        <p className="font-medium">{profile?.email}</p>
      </div>
      {/* ... phone, DOB, address, DL, medical condition ... */}
    </div>
    <div className="mt-4 pt-4 border-t">
      <Link href="/dashboard/applicant/registration">
        <Button variant="outline" size="sm" type="button">Edit Profile Information</Button>
      </Link>
    </div>
  </CardContent>
</Card>

{/* Package-specific dynamic custom fields */}
{Array.isArray((selectedPackage as any)?.formFields) && (selectedPackage as any).formFields.length > 0 && (
  <div className="space-y-4">
    {(selectedPackage as any).formFields.map((field: any, idx: number) => (
      <div key={field.name || idx}>
        <Label>{field.label || field.name}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
        {field.type === "textarea" ? (
          <Textarea
            value={customFields[field.name] || ""}
            onChange={(e) => setCustomFields({ ...customFields, [field.name]: e.target.value })}
          />
        ) : field.type === "select" ? (
          <Select
            value={customFields[field.name] || ""}
            onValueChange={(value) => setCustomFields({ ...customFields, [field.name]: value })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            type={field.type === "phone" ? "tel" : field.type || "text"}
            value={customFields[field.name] || ""}
            onChange={(e) => setCustomFields({ ...customFields, [field.name]: e.target.value })}
          />
        )}
      </div>
    ))}
  </div>
)}
```

---

## CHANGE 7: SendGrid Email Service (server/email.ts)

### WHY
The system needs to send 3 types of transactional emails:
1. **Doctor Approval Email** — sent to the assigned doctor with patient details + "Review & Approve" button
2. **Admin Notification Email** — sent to the admin notification email with the same info
3. **Patient Approval Email** — sent to the patient when their application is approved

### HOW IT WORKS
- Uses `@sendgrid/mail` package
- Reads `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` from environment
- `isEmailConfigured()` checks if the API key exists before attempting to send
- Each function generates an inline-styled HTML email and sends via `sgMail.send()`
- All functions return `boolean` (true = sent, false = skipped/failed)

### FULL FILE: `server/email.ts`

```typescript
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@parkingrx.com";
// ^^^ CUSTOMIZE: Change default from-email for your project

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

  // CUSTOMIZE: Change "Handicap Permit Services" to your service name
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#1e40af;padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">Handicap Permit Services</h1>
        <p style="color:#bfdbfe;margin:4px 0 0;font-size:14px;">New Application Review Request</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;">
          Hello Dr. ${data.doctorName},
        </p>
        <p style="color:#374151;font-size:16px;line-height:1.6;">
          A new application has been submitted and requires your review.
        </p>
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
        <p style="color:#9ca3af;font-size:12px;margin:0;">
          Handicap Permit Services &bull; Secure Review System
        </p>
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

  // CUSTOMIZE: Change "Handicap Permit Services" to your service name
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#7c3aed;padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">Handicap Permit Services</h1>
        <p style="color:#ddd6fe;margin:4px 0 0;font-size:14px;">Admin Notification — New Review Request</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;">
          A new application has been sent for doctor review.
        </p>
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
        <p style="color:#9ca3af;font-size:12px;margin:0;">
          Handicap Permit Services &bull; Admin Notification
        </p>
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

export async function sendPatientApprovalEmail(data: PatientDocumentEmailData): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("SendGrid not configured — skipping patient document email");
    return false;
  }

  // CUSTOMIZE: Change "Handicap Permit Services" to your service name
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#16a34a;padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">Handicap Permit Services</h1>
        <p style="color:#bbf7d0;margin:4px 0 0;font-size:14px;">Your Application Has Been Approved!</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;">
          Hello ${data.patientName},
        </p>
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
        <p style="color:#6b7280;font-size:13px;text-align:center;">
          Application ID: ${data.applicationId}
        </p>
      </div>
      <div style="background:#f3f4f6;padding:16px 32px;text-align:center;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">
          Handicap Permit Services &bull; Thank you for choosing us
        </p>
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

### REQUIRED ENVIRONMENT SECRETS
```
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### IMPORT IN server/routes.ts
Add this at the top of `server/routes.ts`:
```typescript
import { sendDoctorApprovalEmail, sendAdminNotificationEmail, sendPatientApprovalEmail } from "./email";
```

---

## CHANGE 8: Admin Notification Email Setting (SettingsPage.tsx)

### WHY
Admins need a place to set the email address that receives a copy of every doctor approval request. This email gets the same review link with the same Approve button as the doctor.

### WHAT TO ADD
In `client/src/pages/dashboard/shared/SettingsPage.tsx`, add this component and render it conditionally for Level 3+ users:

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
      await apiRequest("PUT", "/api/admin/settings", {
        notificationEmail: notificationEmail.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Notification Email Saved",
        description: "The admin notification email has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
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
            placeholder="admin@parkingrx.com"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            data-testid="input-notification-email"
            className="flex-1"
          />
          <Button
            onClick={saveNotificationEmail}
            disabled={isSaving}
            data-testid="button-save-notification-email"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
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

### BACKEND: Admin Settings API
These endpoints store/retrieve settings in the Firestore `adminSettings` collection:

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

### STORAGE METHODS (server/storage.ts)

```typescript
async getAdminSettings(): Promise<Record<string, any> | undefined> {
  const doc = await this.col("adminSettings").doc("global").get();
  return doc.exists ? (doc.data() as Record<string, any>) : undefined;
}

async updateAdminSettings(data: Record<string, any>): Promise<Record<string, any>> {
  const ref = this.col("adminSettings").doc("global");
  await ref.set(data, { merge: true });
  const doc = await ref.get();
  return doc.data() as Record<string, any>;
}
```

---

## CHANGE 9: Package-Specific Required Fields (PackagesManagement.tsx)

### WHY
Different permit types may need different information from applicants. The admin should be able to define custom form fields per package that applicants fill out during their application.

### HOW IT WORKS
1. The `packages` table/collection has a `formFields` jsonb column storing an array of field definitions
2. Admin UI has a "Required Fields" section with Add/Remove buttons
3. Each field has: `name` (auto-generated slug), `label`, `type` (text/textarea/select/date/email/phone/number), `required` (toggle), `options` (for select type)
4. When an applicant selects a package in NewApplication.tsx, the form dynamically renders these fields in Step 2

### FORM FIELD SCHEMA

```typescript
const formFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "select", "date", "email", "phone", "number"]),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
});
```

### ADMIN UI FOR MANAGING FIELDS

```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <FormLabel>Required Fields</FormLabel>
    <Button type="button" variant="outline" size="sm" onClick={addFormField}>
      <Plus className="h-3 w-3 mr-1" /> Add Field
    </Button>
  </div>
  <p className="text-xs text-muted-foreground">
    Define what information the system needs to collect from applicants for this package.
  </p>
  {formFields.map((field, index) => (
    <div key={index} className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Field {index + 1}</span>
        <Button type="button" variant="ghost" size="icon" onClick={() => removeFormField(index)} className="h-6 w-6">
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Field label"
          value={field.label}
          onChange={(e) => updateFormField(index, {
            label: e.target.value,
            name: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
          })}
        />
        <Select value={field.type} onValueChange={(value) => updateFormField(index, { type: value as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="textarea">Long Text</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="select">Dropdown</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {field.type === "select" && (
        <Input
          placeholder="Options (comma-separated)"
          value={(field.options || []).join(", ")}
          onChange={(e) => updateFormField(index, {
            options: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
          })}
        />
      )}
      <div className="flex items-center gap-2">
        <Switch
          checked={field.required}
          onCheckedChange={(checked) => updateFormField(index, { required: checked })}
        />
        <span className="text-xs text-muted-foreground">Required</span>
      </div>
    </div>
  ))}
</div>
```

### STATE MANAGEMENT FOR FORM FIELDS

```typescript
const [formFields, setFormFields] = useState<FormFieldDef[]>([]);

const addFormField = () => {
  setFormFields([...formFields, { name: "", label: "", type: "text", required: true }]);
};

const removeFormField = (index: number) => {
  setFormFields(formFields.filter((_, i) => i !== index));
};

const updateFormField = (index: number, field: Partial<FormFieldDef>) => {
  const updated = [...formFields];
  updated[index] = { ...updated[index], ...field };
  // Auto-generate slug from label
  if (field.label && !updated[index].name) {
    updated[index].name = field.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  }
  setFormFields(updated);
};
```

---

## CHANGE 10: Auto-Send to Doctor on Application Creation (server/routes.ts)

### WHY
When an applicant submits their application (with `autoSendToDoctor: true` or `paymentStatus: "paid"`), the system automatically assigns a doctor via round-robin, creates a review token, and sends emails to both the doctor and the admin notification email.

### HOW IT WORKS
Inside the `POST /api/applications` handler, after creating the application and workflow steps:

```typescript
if (req.body.paymentStatus === "paid" || req.body.autoSendToDoctor) {
  try {
    const doctor = await storage.getNextDoctorForAssignment();
    if (doctor) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await storage.createDoctorReviewToken({
        applicationId: application.id,
        doctorId: doctor.userId || doctor.id,
        token,
        status: "pending",
        expiresAt,
      });

      await storage.updateApplication(application.id, {
        status: "doctor_review",
        assignedReviewerId: doctor.userId || doctor.id,
      });

      const patient = req.user!;
      const doctorUser = await storage.getUser(doctor.userId || doctor.id);
      const protocol = process.env.NODE_ENV === "production" ? "https" : "https";
      const host = req.get("host") || "localhost:5000";
      const reviewUrl = `${protocol}://${host}/review/${token}`;
      const patientName = `${patient.firstName} ${patient.lastName}`;

      // Send email to doctor
      if (doctorUser?.email) {
        sendDoctorApprovalEmail({
          doctorEmail: doctorUser.email,
          doctorName: doctorUser.lastName || doctor.fullName || "Doctor",
          patientName,
          patientEmail: patient.email,
          packageName: pkg.name,
          formData: formData || {},
          reviewUrl,
          applicationId: application.id,
        }).catch(err => console.error("Auto doctor email error:", err));
      }

      // Send email to admin notification address
      const adminSettings = await storage.getAdminSettings();
      const notificationEmail = adminSettings?.notificationEmail;
      if (notificationEmail) {
        sendAdminNotificationEmail({
          adminEmail: notificationEmail,
          doctorName: doctorUser?.lastName || doctor.fullName || "Doctor",
          patientName,
          patientEmail: patient.email,
          packageName: pkg.name,
          formData: formData || {},
          reviewUrl,
          applicationId: application.id,
        }).catch(err => console.error("Auto admin email error:", err));
      }

      fireAutoMessageTriggers(application.id, "doctor_review");
      application.status = "doctor_review";
    }
  } catch (autoErr) {
    console.error("Auto send-to-doctor failed (non-blocking):", autoErr);
  }
}
```

### ROUND-ROBIN ASSIGNMENT (server/storage.ts)

```typescript
async getNextDoctorForAssignment(): Promise<Record<string, any> | undefined> {
  const doctors = await this.getActiveDoctors();
  if (doctors.length === 0) return undefined;

  const settings = await this.getAdminSettings();
  const lastAssignedDoctorId = settings?.lastAssignedDoctorId || null;

  if (!lastAssignedDoctorId) {
    await this.updateAdminSettings({ lastAssignedDoctorId: doctors[0].userId });
    return doctors[0];
  }

  const lastIndex = doctors.findIndex(d => d.userId === lastAssignedDoctorId);
  const nextIndex = (lastIndex + 1) % doctors.length;
  const nextDoctor = doctors[nextIndex];

  await this.updateAdminSettings({ lastAssignedDoctorId: nextDoctor.userId });
  return nextDoctor;
}

async getActiveDoctors(): Promise<Record<string, any>[]> {
  const snap = await this.col("doctorProfiles").get();
  const profiles = docsToRecords(snap);
  const active = profiles.filter(p => !p._isPlaceholder && p.isActive !== false);
  return active.sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aDate - bDate;
  });
}
```

---

## CHANGE 11: Doctor Approval → Auto-Generate Document + Email Patient (server/routes.ts)

### WHY
When a doctor approves an application via the token-based review link, the system should automatically generate the permit document and email the patient a notification with a link to their dashboard.

### HOW IT WORKS
In the `POST /api/review/:token/decision` handler, when `decision === "approved"`:

```typescript
if (decision === "approved") {
  await storage.updateApplication(tokenRecord.applicationId, {
    status: "doctor_approved",
    level2Notes: notes,
    level2ApprovedAt: new Date(),
    level2ApprovedBy: tokenRecord.doctorId,
    assignedReviewerId: tokenRecord.doctorId,
  });

  // Auto-generate the permit document
  await autoGenerateDocument(tokenRecord.applicationId, tokenRecord.doctorId);
  fireAutoMessageTriggers(tokenRecord.applicationId, "doctor_approved");

  // Notify patient via in-app notification
  if (application?.userId) {
    await storage.createNotification({
      userId: application.userId,
      type: "application_approved",
      title: "Application Approved",
      message: "Your application has been approved by the reviewing doctor. Your documents are being prepared.",
      isRead: false,
    });

    // Send approval email to patient
    const patient = await storage.getUser(application.userId);
    const pkg = application.packageId ? await storage.getPackage(application.packageId) : null;
    if (patient?.email) {
      const protocol = process.env.NODE_ENV === "production" ? "https" : "https";
      const host = req.get("host") || "localhost:5000";
      const dashboardUrl = `${protocol}://${host}/dashboard/applicant/documents`;
      sendPatientApprovalEmail({
        patientEmail: patient.email,
        patientName: `${patient.firstName} ${patient.lastName}`,
        packageName: pkg?.name || "Handicap Permit",
        applicationId: tokenRecord.applicationId,
        dashboardUrl,
      }).catch(err => console.error("Patient approval email error:", err));
    }
  }
}
```

### AUTO-GENERATE DOCUMENT FUNCTION
Defined at the top of `server/routes.ts` (before the route handlers):

```typescript
async function autoGenerateDocument(applicationId: string, doctorId: string) {
  try {
    const app = await storage.getApplication(applicationId);
    if (!app) return;

    const doctorProfile = await storage.getDoctorProfileByUserId(doctorId);
    const patient = app.userId ? await storage.getUser(app.userId) : null;

    const docContent = {
      applicationId,
      packageName: (app as any).packageName || "Service Document",
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Patient",
      patientEmail: patient?.email || "",
      doctorName: doctorProfile?.fullName || "Physician",
      doctorLicense: doctorProfile?.licenseNumber || "",
      doctorNPI: doctorProfile?.npiNumber || "",
      doctorDEA: doctorProfile?.deaNumber || "",
      generatedAt: new Date().toISOString(),
      status: "auto_generated",
      notes: app.level2Notes || app.level3Notes || "",
    };

    const document = await storage.createDocument({
      applicationId,
      userId: app.userId || "",
      name: `${(app as any).packageName || "Document"} - Auto Generated`,
      type: "auto_generated",
      status: "completed",
      fileUrl: "",
      metadata: docContent,
    } as any);

    return document;
  } catch (error) {
    console.error("Error auto-generating document:", error);
  }
}
```

---

## CHANGE 12: Manual Send-to-Doctor (Admin) with Email (server/routes.ts)

### WHY
Admins can also manually trigger doctor assignment (e.g., for applications that didn't auto-send). This endpoint does the same thing as auto-send but is triggered by an admin action.

### ENDPOINT: `POST /api/admin/applications/:id/send-to-doctor`

```typescript
app.post("/api/admin/applications/:id/send-to-doctor", requireAuth, requireLevel(3), async (req, res) => {
  try {
    const applicationId = req.params.id as string;
    const { doctorId: manualDoctorId } = req.body;

    const application = await storage.getApplication(applicationId);
    if (!application) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    // Use manually specified doctor or round-robin
    let doctor;
    if (manualDoctorId) {
      doctor = await storage.getDoctorProfile(manualDoctorId);
      if (!doctor) {
        const allDoctors = await storage.getActiveDoctors();
        doctor = allDoctors.find(d => d.userId === manualDoctorId);
      }
    } else {
      doctor = await storage.getNextDoctorForAssignment();
    }

    if (!doctor) {
      res.status(400).json({ message: "No active doctors available for assignment" });
      return;
    }

    // Create review token (7-day expiry)
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const reviewToken = await storage.createDoctorReviewToken({
      applicationId,
      doctorId: doctor.userId || doctor.id,
      token,
      status: "pending",
      expiresAt,
    });

    // Update application status
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

    // Create in-app notifications
    await storage.createNotification({
      userId: req.user!.id,
      type: "doctor_assignment",
      title: "Application Sent to Doctor",
      message: `Application for ${patient?.firstName || "Patient"} ${patient?.lastName || ""} sent to Dr. ${doctorUser?.lastName || doctor.fullName || "Doctor"}.`,
      isRead: false,
      actionUrl: reviewUrl,
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

    // Send emails
    const doctorEmail = doctorUser?.email;
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Patient";
    const patientEmail = patient?.email || "";
    const packageName = pkg?.name || "Handicap Permit";

    if (doctorEmail) {
      sendDoctorApprovalEmail({
        doctorEmail,
        doctorName: doctorUser?.lastName || doctor.fullName || "Doctor",
        patientName,
        patientEmail,
        packageName,
        formData: application.formData || {},
        reviewUrl,
        applicationId,
      }).catch(err => console.error("Doctor email error:", err));
    }

    const adminSettings = await storage.getAdminSettings();
    const notificationEmail = adminSettings?.notificationEmail;
    if (notificationEmail) {
      sendAdminNotificationEmail({
        adminEmail: notificationEmail,
        doctorName: doctorUser?.lastName || doctor.fullName || "Doctor",
        patientName,
        patientEmail,
        packageName,
        formData: application.formData || {},
        reviewUrl,
        applicationId,
      }).catch(err => console.error("Admin notification email error:", err));
    }

    // Log activity
    await storage.createActivityLog({
      userId: req.user!.id,
      action: "application_sent_to_doctor",
      entityType: "application",
      entityId: applicationId,
      details: {
        doctorId: doctor.userId || doctor.id,
        doctorName: doctorUser ? `${doctorUser.firstName} ${doctorUser.lastName}` : doctor.fullName,
        reviewUrl,
        tokenId: reviewToken.id,
      } as any,
    });

    res.json({
      message: "Application sent to doctor",
      reviewUrl,
      doctor: { ... },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

---

## COMPLETE DATA FLOW SUMMARY

```
1. USER REGISTERS (Register.tsx)
   → All fields saved to Firestore users collection
   → registrationComplete flag computed and stored

2. USER VIEWS/UPDATES PROFILE (RegistrationPage.tsx)
   → GET /api/profile loads all fields
   → PUT /api/profile updates fields + sets registrationComplete: true
   → Green/amber banner shows completeness status

3. USER CREATES APPLICATION (NewApplication.tsx)
   → Profile completeness check gates access
   → Profile data auto-fills into formData
   → Package-specific custom fields collected
   → POST /api/applications with autoSendToDoctor: true

4. AUTO-SEND TO DOCTOR (server/routes.ts)
   → Round-robin picks next doctor
   → Review token created (32-byte hex, 7-day expiry)
   → Application status → doctor_review
   → Email sent to doctor with Review & Approve button
   → Email sent to admin notification email (if configured)

5. DOCTOR REVIEWS (token-based, no login needed)
   → GET /api/review/:token returns patient/application data
   → POST /api/review/:token/decision with approved/denied

6. ON APPROVAL
   → Application status → doctor_approved
   → autoGenerateDocument() creates document record with doctor credentials
   → Patient notified via in-app notification
   → Patient emailed with "View My Dashboard" button
   → Document available at /dashboard/applicant/documents

7. ON DENIAL
   → Application status → doctor_denied
   → Rejection reason recorded
   → Patient notified via in-app notification
```

---

## CUSTOMIZATION CHECKLIST FOR OTHER PROJECTS

When applying this to a different project, search and replace these strings:

| Find | Replace With |
|------|-------------|
| `"Handicap Permit Services"` | Your service name |
| `"handicap parking permit"` | Your service description |
| `"noreply@parkingrx.com"` | Your from-email |
| `"admin@parkingrx.com"` | Your admin email placeholder |
| `"parkingrx.com"` | Your domain |
| `"Oklahoma Forms 302DC and 750-C"` | Your state-specific forms |
| `"Handicap Permit"` | Your default package name fallback |

All business logic, API structure, data flow, and component architecture remain identical.
