# Firebase Seed Script

This document contains the complete Firebase Firestore seed script used to initialize all 41 collections, create test accounts, packages, and configuration for the Support Animal Registry platform.

## How to Use

The seed runs via a POST request to `/api/admin/seed-firebase`. On first run (no users in the system), no auth is required. After initial seed, re-seeding requires a `BOOTSTRAP_TOKEN` secret.

```bash
# First run (empty database)
curl -X POST http://localhost:5000/api/admin/seed-firebase

# Re-seed (after initial setup)
curl -X POST http://localhost:5000/api/admin/seed-firebase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seed-2026-init"
```

Set the `BOOTSTRAP_TOKEN` environment variable to `seed-2026-init` (or your chosen value) to allow re-seeding.

---

## Test Accounts Created

All accounts use the password: `TestPass123`

| Level | Role | Email |
|-------|------|-------|
| Level 1 | Applicant | level1@test.com |
| Level 2 | Reviewer | level2@test.com |
| Level 3 | Admin | level3@test.com |
| Level 4 | Owner | level4@test.com |

An additional owner account is created at `owner@supportanimalregistry.com`.

---

## All 41 Collections Initialized

```
users, packages, applications, applicationSteps, documents,
messages, queueEntries, payments, commissions, notifications,
activityLogs, siteConfig, userNotes, adminSettings, approvals,
errorLogs, documentStates, commissionSettings, consultationHistory,
formAssignments, formTemplates, formTypes, workflowInstances,
agentQueue, agentClockRecords, bulletin, applicationStatus,
stepData, profileNotes, pushSubscriptions, blogPosts, chargebacks,
referralCodeHistory, referralRegistrations, systemReferralCodes,
termsOfService, termsAcceptances, agentDocuments,
doctorProfiles, autoMessageTriggers, _counters
```

---

## Default Site Configuration

```typescript
const defaultConfig = {
  siteName: "Support Animal Registry",
  tagline: "Fast, trusted support animal registration and certification",
  description: "Get your registered support animal certification quickly and easily. Verified by licensed professionals, legally recognized, and delivered digitally.",
  primaryColor: "#3b82f6",
  secondaryColor: "#6366f1",
  accentColor: "#0ea5e9",
  heroTitle: "Register Your Support Animal Today",
  heroSubtitle: "Need an official support animal registration? We provide fast, legitimate ESA letters and certifications with quick turnaround times. Trusted, secure, and hassle-free.",
  heroButtonText: "Get Started",
  heroButtonLink: "/register",
  heroSecondaryButtonText: "View Packages",
  heroSecondaryButtonLink: "/packages",
  footerQuickLinks: [
    { label: "Home", url: "/" },
    { label: "Packages", url: "/packages" },
    { label: "How It Works", url: "/#how-it-works" },
    { label: "Contact", url: "/contact" }
  ],
  footerLegalLinks: [
    { label: "Privacy Policy", url: "/privacy" },
    { label: "Terms of Service", url: "/terms" },
    { label: "Disclaimer", url: "/disclaimer" }
  ],
  levelNames: {
    level1: "Applicant",
    level2: "Reviewer",
    level3: "Admin",
    level4: "Owner",
  },
  workflowSteps: [
    "Create Account",
    "Select Registration Type",
    "Payment",
    "Provide Details",
    "Professional Review",
    "Certificate Issued",
    "Delivered"
  ],
};
```

---

## Seed Endpoint (Express Route)

```typescript
app.post("/api/admin/seed-firebase", async (req, res) => {
  try {
    const existingUsers = await storage.getAllUsers();
    if (existingUsers.length > 0) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const bootstrapToken = process.env.BOOTSTRAP_TOKEN;
      if (!bootstrapToken || token !== bootstrapToken) {
        res.status(403).json({ message: "System already initialized. Re-seeding requires a valid BOOTSTRAP_TOKEN." });
        return;
      }
    }

    const results: Record<string, any> = {
      counters: false,
      siteConfig: false,
      adminSettings: false,
      commissionSettings: false,
      packages: 0,
      ownerUser: false,
      collections_initialized: [] as string[],
      errors: [] as string[],
    };

    // 1. Initialize _counters collection
    try {
      await storage.initializeCounters();
      results.counters = true;
    } catch (e: any) {
      (results.errors as string[]).push(`Counters init failed: ${e.message}`);
    }

    // 2. Site config
    const existingConfig = await storage.getSiteConfig();
    if (!existingConfig) {
      await storage.updateSiteConfig({ ...defaultConfig } as any);
      results.siteConfig = true;
    } else {
      await storage.updateSiteConfig({
        siteName: defaultConfig.siteName,
        tagline: defaultConfig.tagline,
        description: defaultConfig.description,
        heroTitle: defaultConfig.heroTitle,
        heroSubtitle: defaultConfig.heroSubtitle,
        heroButtonText: defaultConfig.heroButtonText,
        heroButtonLink: defaultConfig.heroButtonLink,
        heroSecondaryButtonText: defaultConfig.heroSecondaryButtonText,
        heroSecondaryButtonLink: defaultConfig.heroSecondaryButtonLink,
        levelNames: defaultConfig.levelNames,
        workflowSteps: defaultConfig.workflowSteps,
        footerQuickLinks: defaultConfig.footerQuickLinks,
        footerLegalLinks: defaultConfig.footerLegalLinks,
      } as any);
      results.siteConfig = "updated";
    }

    // 3. Admin settings
    const existingAdmin = await storage.getAdminSettings();
    if (!existingAdmin) {
      await storage.updateAdminSettings({
        availableStates: ["OK", "TX", "FL", "CA", "NY"],
        maintenanceMode: false,
        registrationOpen: true,
        maxQueueSize: 50,
        autoAssignAgents: true,
        defaultWorkflowSteps: 6,
      });
      results.adminSettings = true;
      results.collections_initialized.push("adminSettings");
    } else {
      results.adminSettings = "already_exists";
    }

    // 4. Commission settings
    const existingCommSettings = await storage.getCommissionSettings();
    if (!existingCommSettings) {
      await storage.updateCommissionSettings({
        defaultRate: 10,
        agentCommissionPercent: 15,
        autoApprove: false,
        minPayoutAmount: 5000,
        payoutSchedule: "monthly",
      });
      results.commissionSettings = true;
      results.collections_initialized.push("commissionSettings");
    } else {
      results.commissionSettings = "already_exists";
    }

    // 5. Packages
    const existingPackages = await storage.getActivePackages();
    if (existingPackages.length === 0) {
      const seedPackages = [
        {
          name: "ESA Letter",
          description: "Emotional Support Animal letter for housing and travel. Reviewed and signed by a licensed professional.",
          price: 4999,
          isActive: true,
          requiresLevel2: false,
          features: ["Same-day delivery", "Digital copy", "Verification number"],
          category: "standard",
        },
        {
          name: "Housing ESA Certification",
          description: "Comprehensive ESA certification for landlords and housing providers. Compliant with the Fair Housing Act.",
          price: 7999,
          isActive: true,
          requiresLevel2: true,
          features: ["Priority processing", "Professional consultation", "Detailed documentation", "Print-ready PDF"],
          category: "urgent",
        },
        {
          name: "PSD Letter",
          description: "Psychiatric Service Dog letter with professional evaluation. Includes follow-up recommendations.",
          price: 12999,
          isActive: true,
          requiresLevel2: true,
          features: ["Professional evaluation", "Comprehensive documentation", "Follow-up plan", "Priority support"],
          category: "specialist",
        },
      ];

      for (const pkg of seedPackages) {
        try {
          await storage.createPackage(pkg as any);
          results.packages++;
        } catch (e: any) {
          (results.errors as string[]).push(`Failed to create package ${pkg.name}: ${e.message}`);
        }
      }
    } else {
      results.packages = `${existingPackages.length}_already_exist`;
    }

    // 6. Test accounts for all 4 levels
    const testPassword = "TestPass123";
    const hashedTestPassword = await bcrypt.hash(testPassword, 10);
    const testAccounts = [
      { email: "level1@test.com", firstName: "Test", lastName: "Patient", userLevel: 1, referralCode: "TEST_L1" },
      { email: "level2@test.com", firstName: "Test", lastName: "Doctor", userLevel: 2, referralCode: "TEST_L2" },
      { email: "level3@test.com", firstName: "Test", lastName: "Admin", userLevel: 3, referralCode: "TEST_L3" },
      { email: "level4@test.com", firstName: "Test", lastName: "Owner", userLevel: 4, referralCode: "TEST_L4" },
    ];

    results.testAccounts = [] as string[];
    for (const acct of testAccounts) {
      try {
        const existing = await storage.getUserByEmail(acct.email);
        if (existing) {
          await storage.updateUser(existing.id, { passwordHash: hashedTestPassword } as any);
          (results.testAccounts as string[]).push(`${acct.email} (Level ${acct.userLevel}) - updated`);
        } else {
          await storage.createUser({
            ...acct,
            passwordHash: hashedTestPassword,
            isActive: true,
          } as any);
          (results.testAccounts as string[]).push(`${acct.email} (Level ${acct.userLevel}) - created`);
        }
      } catch (e: any) {
        (results.errors as string[]).push(`Failed to create ${acct.email}: ${e.message}`);
      }
    }

    // Also ensure owner account exists as Level 4
    const allUsers = await storage.getAllUsers();
    const hasOwner = allUsers.some((u: any) => u.userLevel === 4 && u.email === "owner@supportanimalregistry.com");
    if (!hasOwner) {
      try {
        const ownerEmail = req.body?.email || "owner@supportanimalregistry.com";
        const ownerPassword = req.body?.password || testPassword;
        const hashedOwnerPw = await bcrypt.hash(ownerPassword, 10);
        await storage.createUser({
          email: ownerEmail,
          passwordHash: hashedOwnerPw,
          firstName: "Platform",
          lastName: "Owner",
          userLevel: 4,
          isActive: true,
          referralCode: "OWNER001",
        } as any);
        results.ownerUser = true;
      } catch (e: any) {
        (results.errors as string[]).push(`Failed to create owner: ${e.message}`);
      }
    } else {
      results.ownerUser = "already_exists";
    }

    // 7. Initialize remaining collections with placeholder docs using storage methods
    const initCollection = async (name: string, checkFn: () => Promise<any>, createFn: () => Promise<any>) => {
      try {
        const existing = await checkFn();
        const isEmpty = Array.isArray(existing) ? existing.length === 0 : !existing;
        if (isEmpty) {
          await createFn();
          results.collections_initialized.push(name);
        }
      } catch (e: any) {
        (results.errors as string[]).push(`Failed to init ${name}: ${e.message}`);
      }
    };

    await initCollection("formTemplates",
      () => storage.getFormTemplates(),
      () => storage.createFormTemplate({ name: "Default Template", description: "System template", isActive: true, fields: [] })
    );
    await initCollection("formTypes",
      () => storage.getFormTypes(),
      () => storage.createFormType({ name: "Registration Form", description: "Standard support animal registration form", isActive: true })
    );
    await initCollection("bulletin",
      () => storage.getBulletins(),
      () => storage.createBulletin({ title: "Welcome", message: "Platform is live and ready.", isActive: true, priority: "normal", targetLevels: [1, 2, 3, 4] })
    );
    await initCollection("termsOfService",
      () => storage.getTermsOfService(),
      () => storage.updateTermsOfService({ version: "1.0", content: "Terms of Service placeholder. Update this with your actual terms.", isActive: true })
    );
    await initCollection("systemReferralCodes",
      () => storage.getSystemReferralCodes(),
      () => storage.createSystemReferralCode({ code: "WELCOME2025", discountPercent: 10, isActive: true, description: "Welcome discount" })
    );
    await initCollection("blogPosts",
      () => storage.getBlogPosts(),
      () => storage.createBlogPost({ title: "Welcome to Our Platform", content: "We are excited to launch our support animal registration service.", isPublished: true, authorId: "system" })
    );

    // 8. Initialize ALL remaining collections with placeholder docs
    const remainingCollections: { name: string; doc: Record<string, any> }[] = [
      { name: "approvals", doc: { type: "system_init", status: "placeholder" } },
      { name: "errorLogs", doc: { level: "info", message: "Collection initialized", source: "seed" } },
      { name: "documentStates", doc: { status: "initialized", description: "Collection initialized" } },
      { name: "consultationHistory", doc: { type: "system_init", status: "placeholder" } },
      { name: "formAssignments", doc: { type: "system_init", status: "placeholder" } },
      { name: "workflowInstances", doc: { type: "system_init", status: "placeholder" } },
      { name: "agentQueue", doc: { type: "system_init", status: "placeholder" } },
      { name: "agentClockRecords", doc: { type: "system_init", status: "placeholder" } },
      { name: "applicationStatus", doc: { type: "system_init", currentStep: 0, status: "placeholder" } },
      { name: "stepData", doc: { type: "system_init", step: 0, status: "placeholder" } },
      { name: "profileNotes", doc: { type: "system_init", note: "Collection initialized" } },
      { name: "pushSubscriptions", doc: { type: "system_init", status: "placeholder" } },
      { name: "chargebacks", doc: { type: "system_init", status: "placeholder", amount: 0 } },
      { name: "referralCodeHistory", doc: { type: "system_init", status: "placeholder" } },
      { name: "referralRegistrations", doc: { type: "system_init", status: "placeholder" } },
      { name: "termsAcceptances", doc: { type: "system_init", status: "placeholder" } },
      { name: "agentDocuments", doc: { type: "system_init", status: "placeholder" } },
      { name: "doctorProfiles", doc: { type: "system_init", status: "placeholder", specialty: "General" } },
      { name: "autoMessageTriggers", doc: { type: "system_init", status: "placeholder", triggerStatus: "none" } },
    ];

    for (const col of remainingCollections) {
      try {
        const created = await storage.initCollectionWithPlaceholder(col.name, col.doc);
        if (created) {
          results.collections_initialized.push(col.name);
        }
      } catch (e: any) {
        (results.errors as string[]).push(`Failed to init ${col.name}: ${e.message}`);
      }
    }

    res.json({
      success: true,
      message: "Firebase seed complete - all Support Animal Registry collections initialized",
      details: results,
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    res.status(500).json({ message: error.message });
  }
});
```

---

## Storage Helper Methods (Firestore)

These methods are used by the seed endpoint and should be implemented in your storage class.

### initializeCounters

Creates a `_counters` collection with a count document for each collection. Used for auto-incrementing IDs.

```typescript
async initializeCounters(): Promise<void> {
  const collections = [
    "users", "packages", "applications", "applicationSteps", "documents",
    "messages", "queueEntries", "payments", "commissions", "notifications",
    "activityLogs", "siteConfig", "userNotes", "adminSettings", "approvals",
    "errorLogs", "documentStates", "commissionSettings", "consultationHistory",
    "formAssignments", "formTemplates", "formTypes", "workflowInstances",
    "agentQueue", "agentClockRecords", "bulletin", "applicationStatus",
    "stepData", "profileNotes", "pushSubscriptions", "blogPosts", "chargebacks",
    "referralCodeHistory", "referralRegistrations", "systemReferralCodes",
    "termsOfService", "termsAcceptances", "agentDocuments",
    "doctorProfiles", "autoMessageTriggers"
  ];
  const db = getDb();
  const batch = db.batch();
  for (const col of collections) {
    const ref = db.collection("_counters").doc(col);
    const existing = await ref.get();
    if (!existing.exists) {
      batch.set(ref, { count: 0 });
    }
  }
  await batch.commit();
}
```

### initCollectionWithPlaceholder

Creates a placeholder document in a collection if it's empty, ensuring the collection appears in Firestore.

```typescript
async initCollectionWithPlaceholder(collectionName: string, placeholderDoc: Record<string, any>): Promise<boolean> {
  const snap = await db.collection(collectionName).limit(1).get();
  if (!snap.empty) return false;
  const id = `_placeholder_${randomUUID().slice(0, 8)}`;
  await db.collection(collectionName).doc(id).set({
    ...placeholderDoc,
    _isPlaceholder: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  return true;
}
```

---

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email (e.g. `firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com`) |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `BOOTSTRAP_TOKEN` | Token for re-seeding (e.g. `seed-2026-init`) |

---

## Required npm Dependencies

```
bcryptjs
firebase-admin
```
