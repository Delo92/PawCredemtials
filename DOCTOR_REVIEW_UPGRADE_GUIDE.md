# Doctor Review Token System - Upgrade Guide

This document explains how to upgrade from the old call queue / reviewer system to the new **secure doctor review token workflow**. Doctors approve or deny applications via secure email links -- no login is required on their end.

---

## Overview: How the New Flow Works

```
1. Patient creates account, selects package, completes payment
2. Application created with status "pending"
3. Admin clicks "Send to Doctor" button on the application
   - System auto-assigns a doctor using round-robin rotation
   - Generates a secure one-time review link (32-byte hex token, expires in 7 days)
   - Application status changes to "doctor_review"
4. Doctor receives the review link (copy/email it to them)
   - Opens public review portal at /review/:token (NO login required)
   - Reviews patient info, application details, form data
   - Clicks "Approve" or "Deny"
5. On approval:
   - Application status → "doctor_approved"
   - Certificate/document auto-generated with doctor credentials
   - Patient notified
6. On denial:
   - Application status → "doctor_denied"
   - Patient notified with reason
```

### Application Status Values

| Status | Meaning |
|--------|---------|
| `pending` | New application, ready to be sent to doctor |
| `doctor_review` | Sent to doctor, awaiting their decision |
| `doctor_approved` | Approved by doctor, certificate generated |
| `doctor_denied` | Denied by doctor |
| `level3_work` | In admin work queue (optional processing) |
| `completed` | Fully completed |
| `rejected` | Application rejected |

---

## Step 1: Schema Changes

### Add the `doctorReviewTokens` table to `shared/schema.ts`

This table stores the secure review tokens that link a doctor to an application.

```typescript
// shared/schema.ts

// ============================================================================
// DOCTOR REVIEW TOKENS (secure links for doctor approvals - no login needed)
// ============================================================================

export const doctorReviewTokens = pgTable("doctor_review_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending, approved, denied, expired
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  doctorNotes: text("doctor_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const doctorReviewTokensRelations = relations(doctorReviewTokens, ({ one }) => ({
  application: one(applications, {
    fields: [doctorReviewTokens.applicationId],
    references: [applications.id],
  }),
  doctor: one(users, {
    fields: [doctorReviewTokens.doctorId],
    references: [users.id],
  }),
}));

export const insertDoctorReviewTokenSchema = createInsertSchema(doctorReviewTokens).omit({ id: true, createdAt: true });
export type InsertDoctorReviewToken = z.infer<typeof insertDoctorReviewTokenSchema>;
export type DoctorReviewToken = typeof doctorReviewTokens.$inferSelect;
```

### Add relation to users table

In the `usersRelations`, add:

```typescript
export const usersRelations = relations(users, ({ one, many }) => ({
  // ... existing relations ...
  doctorReviewTokens: many(doctorReviewTokens),
}));
```

### Update application status comment

In the `applications` table, update the status field comment to reflect new values:

```typescript
status: text("status").notNull().default("pending"),
// pending, doctor_review, doctor_approved, doctor_denied, level3_work, completed, rejected
```

---

## Step 2: Storage Layer Changes

### Add these methods to the `IStorage` interface in `server/storage.ts`

```typescript
export interface IStorage {
  // ... existing methods ...

  // DOCTOR REVIEW TOKENS
  getDoctorReviewToken(id: string): Promise<DoctorReviewToken | undefined>;
  getDoctorReviewTokenByToken(token: string): Promise<DoctorReviewToken | undefined>;
  getDoctorReviewTokensByDoctor(doctorId: string): Promise<DoctorReviewToken[]>;
  getDoctorReviewTokensByApplication(applicationId: string): Promise<DoctorReviewToken[]>;
  createDoctorReviewToken(data: InsertDoctorReviewToken): Promise<DoctorReviewToken>;
  updateDoctorReviewToken(id: string, data: Partial<InsertDoctorReviewToken>): Promise<DoctorReviewToken | undefined>;

  // ROUND-ROBIN DOCTOR ASSIGNMENT
  getNextDoctorForAssignment(): Promise<Record<string, any> | undefined>;
  getActiveDoctors(): Promise<Record<string, any>[]>;

  // ADMIN SETTINGS (stores lastAssignedDoctorId for round-robin)
  getAdminSettings(): Promise<Record<string, any> | undefined>;
  updateAdminSettings(data: Record<string, any>): Promise<Record<string, any>>;
}
```

### Add these imports at the top of `server/storage.ts`

```typescript
import {
  // ... existing imports ...
  type DoctorReviewToken,
  type InsertDoctorReviewToken,
} from "@shared/schema";
```

### Implement the Firestore methods

```typescript
// =========================================================================
// DOCTOR REVIEW TOKENS
// =========================================================================

async getDoctorReviewToken(id: string): Promise<DoctorReviewToken | undefined> {
  const doc = await this.col("doctorReviewTokens").doc(id).get();
  return docToRecord(doc) as DoctorReviewToken | undefined;
}

async getDoctorReviewTokenByToken(token: string): Promise<DoctorReviewToken | undefined> {
  const snap = await this.col("doctorReviewTokens").where("token", "==", token).limit(1).get();
  if (snap.empty) return undefined;
  return docsToRecords(snap)[0] as DoctorReviewToken;
}

async getDoctorReviewTokensByDoctor(doctorId: string): Promise<DoctorReviewToken[]> {
  const snap = await this.col("doctorReviewTokens").where("doctorId", "==", doctorId).get();
  const results = docsToRecords(snap) as DoctorReviewToken[];
  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async getDoctorReviewTokensByApplication(applicationId: string): Promise<DoctorReviewToken[]> {
  const snap = await this.col("doctorReviewTokens").where("applicationId", "==", applicationId).get();
  return docsToRecords(snap) as DoctorReviewToken[];
}

async createDoctorReviewToken(data: InsertDoctorReviewToken): Promise<DoctorReviewToken> {
  const id = randomUUID();
  const tokenData = cleanForFirestore({
    ...data,
    status: data.status ?? "pending",
    createdAt: FieldValue.serverTimestamp(),
  });
  await this.col("doctorReviewTokens").doc(id).set(tokenData);
  const created = await this.col("doctorReviewTokens").doc(id).get();
  await this.incrementCounter("doctorReviewTokens");
  return docToRecord(created) as DoctorReviewToken;
}

async updateDoctorReviewToken(id: string, data: Partial<InsertDoctorReviewToken>): Promise<DoctorReviewToken | undefined> {
  const ref = this.col("doctorReviewTokens").doc(id);
  const existing = await ref.get();
  if (!existing.exists) return undefined;
  await ref.update(cleanForFirestore(data));
  const updated = await ref.get();
  return docToRecord(updated) as DoctorReviewToken;
}
```

### Implement round-robin doctor assignment

```typescript
async getNextDoctorForAssignment(): Promise<Record<string, any> | undefined> {
  const doctors = await this.getActiveDoctors();
  if (doctors.length === 0) return undefined;

  const settings = await this.getAdminSettings();
  const lastAssignedDoctorId = settings?.lastAssignedDoctorId || null;

  // If no previous assignment, start with the first doctor
  if (!lastAssignedDoctorId) {
    await this.updateAdminSettings({ lastAssignedDoctorId: doctors[0].userId });
    return doctors[0];
  }

  // Find the next doctor in rotation (like a draft system)
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

### Implement admin settings (for round-robin state)

```typescript
async getAdminSettings(): Promise<Record<string, any> | undefined> {
  const doc = await this.col("adminSettings").doc("default").get();
  return docToRecord(doc);
}

async updateAdminSettings(data: Record<string, any>): Promise<Record<string, any>> {
  const ref = this.col("adminSettings").doc("default");
  const existing = await ref.get();
  const updateData = cleanForFirestore({ ...data, updatedAt: FieldValue.serverTimestamp() });
  if (existing.exists) {
    await ref.update(updateData);
  } else {
    await ref.set({ ...updateData, createdAt: FieldValue.serverTimestamp() });
  }
  const updated = await ref.get();
  return docToRecord(updated)!;
}
```

---

## Step 3: Backend Routes

### Add these imports to `server/routes.ts`

```typescript
import { randomBytes } from "crypto";
```

### Add helper functions (top of routes file, before route registration)

#### Auto-message trigger helper

```typescript
async function fireAutoMessageTriggers(applicationId: string, newStatus: string) {
  try {
    const app = await storage.getApplication(applicationId);
    if (!app || !app.packageId) return;

    const triggers = await storage.getAutoMessageTriggers(app.packageId);
    const matchingTriggers = triggers.filter(t => t.triggerStatus === newStatus);

    for (const trigger of matchingTriggers) {
      let recipientId: string | null = null;
      if (trigger.recipientType === "patient" && app.userId) {
        recipientId = app.userId;
      } else if (trigger.recipientType === "doctor") {
        recipientId = app.assignedReviewerId || app.assignedAgentId || null;
      }

      if (recipientId) {
        const messageBody = trigger.messageTemplate
          .replace("{{applicationId}}", applicationId)
          .replace("{{status}}", newStatus)
          .replace("{{packageName}}", (app as any).packageName || "your service");

        await storage.createMessage({
          senderId: "system",
          receiverId: recipientId,
          subject: `Application Update: ${newStatus}`,
          content: messageBody,
          isRead: false,
        } as any);

        await storage.createNotification({
          userId: recipientId,
          type: "auto_message",
          title: `Application Update`,
          message: messageBody.substring(0, 200),
          isRead: false,
        });
      }
    }
  } catch (error) {
    console.error("Error firing auto-message triggers:", error);
  }
}
```

#### Auto-document generation helper

This generates a certificate document when a doctor approves an application, embedding the doctor's credentials:

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

### Add the API routes

#### List active doctors (Admin only)

```typescript
app.get("/api/doctors", requireAuth, requireLevel(3), async (req, res) => {
  try {
    const doctors = await storage.getActiveDoctors();
    const doctorsWithUsers = await Promise.all(
      doctors.map(async (doc) => {
        const user = doc.userId ? await storage.getUser(doc.userId) : null;
        return {
          ...doc,
          firstName: user?.firstName,
          lastName: user?.lastName,
          email: user?.email,
        };
      })
    );
    res.json(doctorsWithUsers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

#### Doctor stats (Doctor dashboard)

```typescript
app.get("/api/doctors/stats", requireAuth, requireLevel(2), async (req, res) => {
  try {
    const doctorId = req.query.doctorId as string || req.user!.id;
    const tokens = await storage.getDoctorReviewTokensByDoctor(doctorId);
    const approved = tokens.filter(t => t.status === "approved").length;
    const denied = tokens.filter(t => t.status === "denied").length;
    const pending = tokens.filter(t => t.status === "pending").length;
    res.json({ total: tokens.length, approved, denied, pending, tokens });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

#### Send application to doctor (Admin action - the core route)

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

    // Pick a doctor: manual override or round-robin auto-assignment
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

    // Generate secure 32-byte token, expires in 7 days
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

    // Build the review URL
    const patient = application.userId ? await storage.getUser(application.userId) : null;
    const pkg = application.packageId ? await storage.getPackage(application.packageId) : null;
    const doctorUser = await storage.getUser(doctor.userId || doctor.id);

    const protocol = process.env.NODE_ENV === "production" ? "https" : "https";
    const host = req.get("host") || "localhost:5000";
    const reviewUrl = `${protocol}://${host}/review/${token}`;

    // Notify the admin who sent it
    await storage.createNotification({
      userId: req.user!.id,
      type: "doctor_assignment",
      title: "Application Sent to Doctor",
      message: `Application for ${patient?.firstName || "Patient"} ${patient?.lastName || ""} sent to Dr. ${doctorUser?.lastName || doctor.fullName || "Doctor"}. Review link: ${reviewUrl}`,
      isRead: false,
      actionUrl: reviewUrl,
    });

    // Notify the doctor
    if (doctorUser) {
      await storage.createNotification({
        userId: doctorUser.id,
        type: "review_assigned",
        title: "New Patient Review Assigned",
        message: `You have been assigned to review ${patient?.firstName || "a patient"}'s application for ${pkg?.name || "a service"}.`,
        isRead: false,
      });
    }

    // Fire auto-message triggers for doctor_review status
    fireAutoMessageTriggers(applicationId, "doctor_review");

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

    // Return the review URL so the admin can copy/share it
    res.json({
      message: "Application sent to doctor for review",
      reviewUrl,
      token: reviewToken,
      doctor: {
        id: doctor.userId || doctor.id,
        name: doctorUser ? `${doctorUser.firstName} ${doctorUser.lastName}` : doctor.fullName,
      },
    });
  } catch (error: any) {
    console.error("Send to doctor error:", error);
    res.status(500).json({ message: error.message });
  }
});
```

#### Public review token GET (loads review data - NO AUTH)

```typescript
app.get("/api/review/:token", async (req, res) => {
  try {
    const tokenRecord = await storage.getDoctorReviewTokenByToken(req.params.token);
    if (!tokenRecord) {
      res.status(404).json({ message: "Review link not found or invalid" });
      return;
    }

    if (tokenRecord.status !== "pending") {
      res.status(410).json({ message: "This review has already been completed", status: tokenRecord.status });
      return;
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      await storage.updateDoctorReviewToken(tokenRecord.id, { status: "expired" } as any);
      res.status(410).json({ message: "This review link has expired" });
      return;
    }

    const application = await storage.getApplication(tokenRecord.applicationId);
    if (!application) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    const patient = application.userId ? await storage.getUser(application.userId) : null;
    const pkg = application.packageId ? await storage.getPackage(application.packageId) : null;
    const doctorUser = await storage.getUser(tokenRecord.doctorId);
    const doctorProfile = await storage.getDoctorProfileByUserId(tokenRecord.doctorId);

    res.json({
      tokenId: tokenRecord.id,
      status: tokenRecord.status,
      expiresAt: tokenRecord.expiresAt,
      patient: patient ? {
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        address: patient.address,
        city: patient.city,
        state: patient.state,
        zipCode: patient.zipCode,
      } : null,
      application: {
        id: application.id,
        status: application.status,
        formData: application.formData,
        createdAt: application.createdAt,
      },
      package: pkg ? {
        name: pkg.name,
        description: pkg.description,
      } : null,
      doctor: doctorUser ? {
        firstName: doctorUser.firstName,
        lastName: doctorUser.lastName,
      } : null,
      doctorProfile: doctorProfile ? {
        fullName: doctorProfile.fullName,
        licenseNumber: doctorProfile.licenseNumber,
        specialty: doctorProfile.specialty,
        state: doctorProfile.state,
      } : null,
    });
  } catch (error: any) {
    console.error("Review token lookup error:", error);
    res.status(500).json({ message: "Failed to load review" });
  }
});
```

#### Public decision POST (doctor submits approve/deny - NO AUTH)

```typescript
app.post("/api/review/:token/decision", async (req, res) => {
  try {
    const { decision, notes } = req.body;
    if (!decision || !["approved", "denied"].includes(decision)) {
      res.status(400).json({ message: "Decision must be 'approved' or 'denied'" });
      return;
    }

    const tokenRecord = await storage.getDoctorReviewTokenByToken(req.params.token);
    if (!tokenRecord) {
      res.status(404).json({ message: "Review link not found" });
      return;
    }

    if (tokenRecord.status !== "pending") {
      res.status(410).json({ message: "This review has already been completed" });
      return;
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      await storage.updateDoctorReviewToken(tokenRecord.id, { status: "expired" } as any);
      res.status(410).json({ message: "This review link has expired" });
      return;
    }

    // Mark token as used
    await storage.updateDoctorReviewToken(tokenRecord.id, {
      status: decision,
      usedAt: new Date(),
      doctorNotes: notes || null,
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

      // Auto-generate certificate document with doctor credentials
      await autoGenerateDocument(tokenRecord.applicationId, tokenRecord.doctorId);
      fireAutoMessageTriggers(tokenRecord.applicationId, "doctor_approved");

      // Notify patient
      if (application?.userId) {
        await storage.createNotification({
          userId: application.userId,
          type: "application_approved",
          title: "Application Approved",
          message: "Your application has been approved by the reviewing doctor. Your documents are being prepared.",
          isRead: false,
        });
      }
    } else {
      await storage.updateApplication(tokenRecord.applicationId, {
        status: "doctor_denied",
        level2Notes: notes,
        rejectedAt: new Date(),
        rejectedBy: tokenRecord.doctorId,
        rejectionReason: notes,
      });

      fireAutoMessageTriggers(tokenRecord.applicationId, "doctor_denied");

      // Notify patient
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

    // Log activity
    await storage.createActivityLog({
      userId: tokenRecord.doctorId,
      action: `doctor_${decision}`,
      entityType: "application",
      entityId: tokenRecord.applicationId,
      details: { notes, tokenId: tokenRecord.id } as any,
    });

    res.json({ message: `Application ${decision} successfully`, decision });
  } catch (error: any) {
    console.error("Doctor decision error:", error);
    res.status(500).json({ message: "Failed to submit decision" });
  }
});
```

---

## Step 4: Frontend - Public Doctor Review Portal

### Create `client/src/pages/DoctorReviewPortal.tsx`

This is the page doctors see when they click the review link. It requires NO authentication.

```tsx
import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, Shield, User, FileText, Clock, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function DoctorReviewPortal() {
  const [, params] = useRoute("/review/:token");
  const token = params?.token;
  const [decision, setDecision] = useState<"approved" | "denied" | null>(null);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: reviewData, isLoading, error } = useQuery<{
    patient: any;
    application: any;
    package: any;
    doctor: any;
    doctorProfile: any;
    expiresAt: string;
  }>({
    queryKey: [`/api/review/${token}`],
    enabled: !!token,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { decision: string; notes: string }) => {
      const res = await apiRequest("POST", `/api/review/${token}/decision`, data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading patient review...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Review Unavailable</h2>
            <p className="text-muted-foreground">
              {(error as Error).message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            {decision === "approved" ? (
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            )}
            <h2 className="text-xl font-semibold mb-2">
              Application {decision === "approved" ? "Approved" : "Denied"}
            </h2>
            <p className="text-muted-foreground">
              {decision === "approved"
                ? "The patient's application has been approved. Their documents will be prepared and sent to them."
                : "The patient's application has been denied. They will be notified of the decision."}
            </p>
            <p className="text-sm text-muted-foreground mt-4">You may close this window.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { patient, application, package: pkg, doctor, doctorProfile } = reviewData || {};

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="bg-primary/10 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Secure Patient Review Portal</h1>
            <p className="text-sm text-muted-foreground">Confidential medical review</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Doctor identity */}
        {doctor && (
          <div className="text-sm text-muted-foreground">
            Reviewing as: <span className="font-medium text-foreground">Dr. {doctor.lastName}</span>
            {doctorProfile?.specialty && <span> ({doctorProfile.specialty})</span>}
          </div>
        )}

        {/* Patient info + Application details side by side */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {patient ? (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">Name</span>
                    <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Email</span>
                    <p>{patient.email}</p>
                  </div>
                  {patient.phone && (
                    <div>
                      <span className="text-sm text-muted-foreground">Phone</span>
                      <p>{patient.phone}</p>
                    </div>
                  )}
                  {patient.dateOfBirth && (
                    <div>
                      <span className="text-sm text-muted-foreground">Date of Birth</span>
                      <p>{patient.dateOfBirth}</p>
                    </div>
                  )}
                  {(patient.address || patient.city || patient.state) && (
                    <div>
                      <span className="text-sm text-muted-foreground">Location</span>
                      <p>
                        {[patient.address, patient.city, patient.state, patient.zipCode].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Patient information unavailable</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Application Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pkg && (
                <div>
                  <span className="text-sm text-muted-foreground">Service Package</span>
                  <p className="font-medium">{pkg.name}</p>
                  {pkg.description && <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>}
                </div>
              )}
              {application && (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">Application ID</span>
                    <p className="font-mono text-sm">{application.id}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Submitted</span>
                    <p>{new Date(application.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant="secondary">{application.status}</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Form data from application */}
        {application?.formData && Object.keys(application.formData).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Application Form Data</CardTitle>
              <CardDescription>Information provided by the patient</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(application.formData).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-sm text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                    </span>
                    <p className="font-medium">{String(value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Decision section */}
        <Card>
          <CardHeader>
            <CardTitle>Your Decision</CardTitle>
            <CardDescription>Review the patient information above and make your determination</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes or comments about your decision..."
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  setDecision("approved");
                  submitMutation.mutate({ decision: "approved", notes });
                }}
                disabled={submitMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {submitMutation.isPending && decision === "approved" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Approve Application
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setDecision("denied");
                  submitMutation.mutate({ decision: "denied", notes });
                }}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending && decision === "denied" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Deny Application
              </Button>
            </div>

            {submitMutation.isError && (
              <p className="text-sm text-destructive">
                {(submitMutation.error as Error).message}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
              <Clock className="h-3 w-3" />
              <span>
                This review link expires on {reviewData?.expiresAt ? new Date(reviewData.expiresAt).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Step 5: Frontend - Register the Route in App.tsx

Add the public review route **outside** of any `ProtectedRoute` wrapper since doctors don't need to log in:

```tsx
// At the top of App.tsx, add the lazy import:
const DoctorReviewPortal = lazy(() => import("@/pages/DoctorReviewPortal"));

// In the Router component, add this route OUTSIDE of any ProtectedRoute:
<Route path="/review/:token">
  <DoctorReviewPortal />
</Route>
```

Also add redirects from old reviewer routes to the new doctor dashboard:

```tsx
<Route path="/dashboard/reviewer/:rest*">
  <Redirect to="/dashboard/doctor" />
</Route>
<Route path="/dashboard/reviewer">
  <Redirect to="/dashboard/doctor" />
</Route>
```

---

## Step 6: Frontend - Admin "Send to Doctor" Button

In the admin's applications list page (`ApplicationsListPage.tsx`), add the "Send to Doctor" action:

### Key state and mutation

```tsx
const [sendingAppId, setSendingAppId] = useState<string | null>(null);
const [reviewLinkDialog, setReviewLinkDialog] = useState<{ url: string; doctorName: string } | null>(null);

const sendToDoctorMutation = useMutation({
  mutationFn: async (applicationId: string) => {
    const res = await apiRequest("POST", `/api/admin/applications/${applicationId}/send-to-doctor`);
    return res.json();
  },
  onSuccess: (data) => {
    toast({
      title: "Sent to Doctor",
      description: `Application sent to ${data.doctor?.name || "doctor"} for review.`,
    });
    setReviewLinkDialog({ url: data.reviewUrl, doctorName: data.doctor?.name || "Doctor" });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
    setSendingAppId(null);
  },
  onError: (error: any) => {
    toast({
      title: "Error",
      description: error.message || "Failed to send to doctor",
      variant: "destructive",
    });
    setSendingAppId(null);
  },
});
```

### Button in the application row (only show for pending/level3_work status)

```tsx
const canSendToDoctor = (status: string) => {
  return status === "pending" || status === "level3_work";
};

// Inside the application row:
{canSendToDoctor(app.status) && user.userLevel >= 3 && (
  <Button
    size="sm"
    onClick={() => {
      setSendingAppId(app.id);
      sendToDoctorMutation.mutate(app.id);
    }}
    disabled={sendToDoctorMutation.isPending && sendingAppId === app.id}
  >
    {sendToDoctorMutation.isPending && sendingAppId === app.id ? (
      <Loader2 className="h-4 w-4 animate-spin mr-1" />
    ) : (
      <Send className="h-4 w-4 mr-1" />
    )}
    Send to Doctor
  </Button>
)}
```

### Review link dialog (shows after sending)

```tsx
<Dialog open={!!reviewLinkDialog} onOpenChange={() => setReviewLinkDialog(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Doctor Review Link Generated</DialogTitle>
      <DialogDescription>
        Copy this secure link and forward it to {reviewLinkDialog?.doctorName} for review.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          value={reviewLinkDialog?.url || ""}
          readOnly
          className="font-mono text-sm"
        />
        <Button
          size="icon"
          variant="outline"
          onClick={() => {
            if (reviewLinkDialog?.url) {
              navigator.clipboard.writeText(reviewLinkDialog.url);
              toast({ title: "Copied", description: "Review link copied to clipboard" });
            }
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          if (reviewLinkDialog?.url) {
            window.open(reviewLinkDialog.url, "_blank");
          }
        }}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Open Link
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

---

## Step 7: Frontend - Doctor Dashboard

Replace any old queue-based dashboard with a review history dashboard. The doctor dashboard at `/dashboard/doctor` should show:

- **Stats cards**: Pending reviews, Approved count, Denied count, Commissions
- **Recent Reviews list**: Pulled from `/api/doctors/stats` which returns all token history
- **Referral link**: For earning commissions

See the full `DoctorDashboard.tsx` component in this project's `client/src/pages/dashboard/DoctorDashboard.tsx` for the complete implementation.

Key query pattern:

```tsx
const { data: statsData, isLoading: statsLoading } = useQuery<{
  total: number;
  approved: number;
  denied: number;
  pending: number;
  tokens: any[];
}>({
  queryKey: ["/api/doctors/stats"],
});
```

---

## Step 8: What to Remove (Old Queue System)

If your project has any of these, they should be removed or replaced:

1. **`queueEntries` table** in schema - Remove entirely
2. **Queue-related storage methods** - `createQueueEntry`, `getQueueEntries`, `updateQueueEntry`, etc.
3. **Queue API routes** - Any routes under `/api/queue/*`
4. **Frontend queue pages** - `CallQueuePage.tsx`, `ReviewerDashboard.tsx` (old versions)
5. **Queue navigation items** in sidebar/navigation
6. **`QueueEntry` type** references throughout the codebase

---

## Firestore Collections Created

This upgrade creates or uses these Firestore collections:

| Collection | Purpose |
|-----------|---------|
| `doctorReviewTokens` | Stores secure review tokens with status, expiry, doctor notes |
| `adminSettings` | Stores `lastAssignedDoctorId` for round-robin rotation |
| `doctorProfiles` | Doctor credentials (must already exist - license, NPI, DEA, etc.) |

---

## Security Notes

- **Tokens are 32-byte hex** (64 characters) - effectively unguessable
- **Single-use**: Once a decision is submitted, the token status changes and can't be reused
- **7-day expiry**: Tokens auto-expire, and the system checks expiry on both GET and POST
- **No authentication required**: The review portal is intentionally public - the token IS the authentication
- **Patient data exposure**: Only necessary patient info is shared (name, email, phone, DOB, address) - no passwords or internal IDs
- **Activity logging**: Every action (send, approve, deny) is logged with full audit trail

---

## API Endpoint Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/doctors` | Level 3+ | List active doctors |
| GET | `/api/doctors/stats` | Level 2+ | Doctor's review stats and token history |
| POST | `/api/admin/applications/:id/send-to-doctor` | Level 3+ | Send application to doctor (creates token) |
| GET | `/api/review/:token` | None | Load application data for doctor review |
| POST | `/api/review/:token/decision` | None | Submit doctor's approve/deny decision |
