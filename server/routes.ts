import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { defaultConfig } from "@shared/config";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads", "gallery");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const galleryUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + randomBytes(4).toString("hex");
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `gallery-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed"));
    }
  },
});

// Session augmentation
declare module "express-session" {
  interface SessionData {
    userId: string;
    userLevel: number;
  }
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

function requireLevel(minLevel: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId || !req.session.userLevel) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (req.session.userLevel < minLevel) {
      res.status(403).json({ message: "Forbidden - Insufficient permissions" });
      return;
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Serve uploaded gallery images as static files
  const express = await import("express");
  app.use("/uploads/gallery", express.default.static(uploadsDir));

  // ===========================================================================
  // FILE UPLOAD ROUTES
  // ===========================================================================

  app.post("/api/upload/gallery", requireAuth, requireLevel(5), (req, res, next) => {
    galleryUpload.single("image")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ message: "File size must be under 10MB" });
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
      const url = `/uploads/gallery/${req.file.filename}`;
      res.json({ url });
    });
  });

  // ===========================================================================
  // AUTH ROUTES
  // ===========================================================================

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, referralCode } = req.body;

      if (!email || !password || !firstName || !lastName) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ message: "Email already registered" });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Generate unique profile ID and referral code
      const profileId = randomBytes(4).toString("hex").toUpperCase();
      const userReferralCode = randomBytes(4).toString("hex").toUpperCase();

      // Check for referral
      let referredByUserId: string | undefined;
      if (referralCode) {
        const referrer = await storage.getUserByReferralCode(referralCode);
        if (referrer) {
          referredByUserId = referrer.id;
        }
      }

      // Create user
      const user = await storage.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        userLevel: 1, // Default to applicant
        profileId,
        referralCode: userReferralCode,
        referredByUserId,
        isActive: true,
      });

      // Create session
      req.session.userId = user.id;
      req.session.userLevel = user.userLevel;

      // Log activity
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
      console.error("Registration error:", error);
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ message: "Email and password required" });
        return;
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }

      if (!user.isActive) {
        res.status(401).json({ message: "Account is deactivated" });
        return;
      }

      // Create session
      req.session.userId = user.id;
      req.session.userLevel = user.userLevel;

      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        action: "user_login",
        entityType: "user",
        entityId: user.id,
      });

      res.json({
        user: {
          ...user,
          passwordHash: undefined,
        },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/firebase", async (req, res) => {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        res.status(400).json({ message: "ID token required" });
        return;
      }

      const { initializeApp, cert, getApps } = await import("firebase-admin/app");
      const { getAuth: getAdminAuth } = await import("firebase-admin/auth");

      if (getApps().length === 0) {
        initializeApp({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        });
      }

      const decodedToken = await getAdminAuth().verifyIdToken(idToken);
      const { uid, email, name, picture } = decodedToken;

      if (!email) {
        res.status(400).json({ message: "Email not available from Google account" });
        return;
      }

      let user = await storage.getUserByFirebaseUid(uid);

      if (!user) {
        user = await storage.getUserByEmail(email);
        if (user) {
          await storage.updateUser(user.id, { firebaseUid: uid, avatarUrl: picture || user.avatarUrl });
          user = (await storage.getUser(user.id))!;
        }
      }

      if (!user) {
        const nameParts = (name || email.split("@")[0]).split(" ");
        const firstName = nameParts[0] || "User";
        const lastName = nameParts.slice(1).join(" ") || "User";
        const profileId = randomBytes(4).toString("hex").toUpperCase();
        const userReferralCode = randomBytes(4).toString("hex").toUpperCase();

        user = await storage.createUser({
          email,
          firebaseUid: uid,
          firstName,
          lastName,
          passwordHash: null,
          userLevel: 1,
          profileId,
          referralCode: userReferralCode,
          avatarUrl: picture || null,
          isActive: true,
        });

        await storage.createActivityLog({
          userId: user.id,
          action: "user_registered",
          entityType: "user",
          entityId: user.id,
          details: { method: "google" },
        });
      }

      if (!user.isActive) {
        res.status(401).json({ message: "Account is deactivated" });
        return;
      }

      req.session.userId = user.id;
      req.session.userLevel = user.userLevel;

      await storage.createActivityLog({
        userId: user.id,
        action: "user_login",
        entityType: "user",
        entityId: user.id,
        details: { method: "google" },
      });

      res.json({
        user: {
          ...user,
          passwordHash: undefined,
        },
      });
    } catch (error: any) {
      console.error("Firebase auth error:", error);
      res.status(401).json({ message: "Authentication failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ message: "Logout failed" });
        return;
      }
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ message: "User not found" });
      return;
    }

    res.json({
      user: {
        ...user,
        passwordHash: undefined,
      },
    });
  });

  // ===========================================================================
  // CONFIG ROUTES
  // ===========================================================================

  app.get("/api/config", async (req, res) => {
    try {
      const config = await storage.getSiteConfig();
      if (config) {
        res.json({
          siteName: config.siteName,
          tagline: config.tagline,
          description: config.description,
          logoUrl: config.logoUrl,
          faviconUrl: config.faviconUrl,
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
          accentColor: config.accentColor,
          heroTitle: config.heroTitle,
          heroSubtitle: config.heroSubtitle,
          heroBackgroundUrl: config.heroBackgroundUrl,
          heroMediaUrl: config.heroMediaUrl,
          heroButtonText: config.heroButtonText,
          heroButtonLink: config.heroButtonLink,
          heroSecondaryButtonText: config.heroSecondaryButtonText,
          heroSecondaryButtonLink: config.heroSecondaryButtonLink,
          footerQuickLinks: config.footerQuickLinks,
          footerLegalLinks: config.footerLegalLinks,
          footerText: config.footerText,
          contactEmail: config.contactEmail,
          contactPhone: config.contactPhone,
          address: config.address,
          galleryImages: config.galleryImages || [],
          levelNames: {
            level1: config.level1Name,
            level2: config.level2Name,
            level3: config.level3Name,
            level4: config.level4Name,
            level5: config.level5Name,
          },
          workflowSteps: defaultConfig.workflowSteps,
          features: defaultConfig.features,
        });
      } else {
        res.json(defaultConfig);
      }
    } catch (error) {
      res.json(defaultConfig);
    }
  });

  // ===========================================================================
  // PACKAGE ROUTES
  // ===========================================================================

  app.get("/api/packages", async (req, res) => {
    try {
      const packages = await storage.getActivePackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/packages/:id", async (req, res) => {
    try {
      const pkg = await storage.getPackage(req.params.id);
      if (!pkg) {
        res.status(404).json({ message: "Package not found" });
        return;
      }
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // APPLICATION ROUTES (Authenticated)
  // ===========================================================================

  app.get("/api/applications", requireAuth, async (req, res) => {
    try {
      const applications = await storage.getApplicationsByUser(req.session.userId!);
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/applications/:id", requireAuth, async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        res.status(404).json({ message: "Application not found" });
        return;
      }
      // Check ownership or admin access
      if (application.userId !== req.session.userId && req.session.userLevel! < 4) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
      res.json(application);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/applications", requireAuth, async (req, res) => {
    try {
      const { packageId, formData } = req.body;

      const pkg = await storage.getPackage(packageId);
      if (!pkg) {
        res.status(400).json({ message: "Invalid package" });
        return;
      }

      const workflowSteps = (pkg.workflowSteps as string[]) || defaultConfig.workflowSteps;

      const application = await storage.createApplication({
        userId: req.session.userId!,
        packageId,
        currentStep: 1,
        totalSteps: workflowSteps.length,
        status: "pending",
        formData: formData || {},
        paymentStatus: "unpaid",
        paymentAmount: pkg.price,
      });

      // Create workflow steps
      for (let i = 0; i < workflowSteps.length; i++) {
        await storage.createApplicationStep({
          applicationId: application.id,
          stepNumber: i + 1,
          name: workflowSteps[i],
          status: i === 0 ? "in-progress" : "pending",
        });
      }

      res.json(application);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // QUEUE ROUTES (Call Queue System)
  // ===========================================================================

  // Get all waiting queue entries (for Level 2+ reviewers)
  app.get("/api/queue", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const entries = await storage.getWaitingQueueEntries();
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get queue stats for Level 2 dashboard
  app.get("/api/queue/stats", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const waiting = await storage.getWaitingQueueEntries();
      const inCall = await storage.getInCallQueueEntries();
      const completed = await storage.getCompletedQueueEntriesToday();
      
      res.json({
        waitingCount: waiting.length,
        inCallCount: inCall.length,
        completedTodayCount: completed.length,
        waiting,
        inCall,
        completed,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 1: Join the call queue
  app.post("/api/queue/join", requireAuth, async (req, res) => {
    try {
      const { packageId, applicationId, phone } = req.body;
      
      // Check if user already in queue
      const existing = await storage.getWaitingQueueEntries();
      const alreadyInQueue = existing.find(e => e.applicantId === req.session.userId && e.status === "waiting");
      if (alreadyInQueue) {
        res.status(400).json({ message: "You are already in the queue", queueEntry: alreadyInQueue });
        return;
      }

      // Get user info for denormalized fields
      const user = await storage.getUser(req.session.userId!);
      let pkg = null;
      if (packageId) {
        pkg = await storage.getPackage(packageId);
      }

      // Calculate position
      const position = existing.length + 1;

      const entry = await storage.createQueueEntry({
        applicantId: req.session.userId!,
        packageId,
        applicationId,
        applicantPhone: phone,
        applicantFirstName: user?.firstName || null,
        applicantLastName: user?.lastName || null,
        applicantState: user?.state || null,
        packageName: pkg?.name || null,
        packagePrice: pkg?.price || null,
        queueType: "consultation",
        status: "waiting",
        position,
        priority: 0,
      });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 1: Check my queue status
  app.get("/api/queue/my-status", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getWaitingQueueEntries();
      const myEntry = entries.find(e => e.applicantId === req.session.userId);
      if (!myEntry) {
        res.json({ inQueue: false });
        return;
      }
      const position = entries.filter(e => e.createdAt <= myEntry.createdAt && e.status === "waiting").length;
      res.json({ inQueue: true, position, entry: myEntry });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 1: Leave the queue
  app.post("/api/queue/leave", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getWaitingQueueEntries();
      const myEntry = entries.find(e => e.applicantId === req.session.userId && e.status === "waiting");
      if (!myEntry) {
        res.status(404).json({ message: "Not in queue" });
        return;
      }
      await storage.updateQueueEntry(myEntry.id, { status: "cancelled" });
      res.json({ message: "Left the queue" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 2+: Claim a caller from the queue
  app.post("/api/queue/:id/claim", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const entry = await storage.getQueueEntry(req.params.id);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.status !== "waiting") {
        res.status(400).json({ message: "This caller has already been claimed" });
        return;
      }
      const updated = await storage.updateQueueEntry(req.params.id, {
        reviewerId: req.session.userId!,
        status: "claimed",
        claimedAt: new Date(),
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 2+: Start call with claimed caller
  app.post("/api/queue/:id/start-call", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const entry = await storage.getQueueEntry(req.params.id);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.reviewerId !== req.session.userId) {
        res.status(403).json({ message: "This caller is not assigned to you" });
        return;
      }
      
      // Here is where Twilio/GHL integration would generate a call
      // For now, just update status
      const updated = await storage.updateQueueEntry(req.params.id, {
        status: "in_call",
        callStartedAt: new Date(),
        // roomId would be set here when Twilio/GHL is integrated
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 2+: Complete a call (approve or deny - moves to Level 3 if approved)
  app.post("/api/queue/:id/complete", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const { notes, outcome } = req.body; // outcome: "approved" or "denied"
      const entry = await storage.getQueueEntry(req.params.id);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.reviewerId !== req.session.userId) {
        res.status(403).json({ message: "This caller is not assigned to you" });
        return;
      }
      const updated = await storage.updateQueueEntry(req.params.id, {
        status: "completed",
        callEndedAt: new Date(),
        completedAt: new Date(),
        notes,
        outcome,
      });
      
      // Update the application status based on outcome
      if (entry.applicationId) {
        if (outcome === "approved") {
          // Move to Level 3 work queue
          await storage.updateApplication(entry.applicationId, {
            status: "level3_work",
            currentLevel: 3,
            level2Notes: notes,
            level2ApprovedAt: new Date(),
            level2ApprovedBy: req.session.userId,
            assignedReviewerId: req.session.userId,
          });
        } else if (outcome === "denied") {
          await storage.updateApplication(entry.applicationId, {
            status: "level2_denied",
            currentLevel: 2,
            level2Notes: notes,
            rejectedAt: new Date(),
            rejectedBy: req.session.userId,
            rejectionReason: notes,
          });
        }
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 2+: Release a claimed caller back to queue
  app.post("/api/queue/:id/release", requireAuth, requireLevel(2), async (req, res) => {
    try {
      const entry = await storage.getQueueEntry(req.params.id);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.reviewerId !== req.session.userId) {
        res.status(403).json({ message: "This caller is not assigned to you" });
        return;
      }
      const updated = await storage.updateQueueEntry(req.params.id, {
        reviewerId: null,
        status: "waiting",
        claimedAt: null,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // COMMISSION ROUTES
  // ===========================================================================

  app.get("/api/commissions", requireAuth, async (req, res) => {
    try {
      if (req.session.userLevel! >= 4) {
        const commissions = await storage.getAllCommissions();
        res.json(commissions);
      } else {
        const commissions = await storage.getCommissionsByAgent(req.session.userId!);
        res.json(commissions);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // LEVEL 3 (AGENT) WORK QUEUE ROUTES
  // ===========================================================================

  // Get Level 3 work queue - applications ready for agent work
  app.get("/api/agent/work-queue", requireAuth, requireLevel(3), async (req, res) => {
    try {
      const applications = await storage.getApplicationsByStatus("level3_work");
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Level 3 work queue stats
  app.get("/api/agent/work-queue/stats", requireAuth, requireLevel(3), async (req, res) => {
    try {
      const allApps = await storage.getApplicationsByStatus("level3_work");
      const waiting = allApps.filter(a => !a.assignedAgentId).length;
      const inProgress = allApps.filter(a => a.assignedAgentId === req.session.userId).length;
      
      // Get all completions by this agent (level4_verification + completed)
      const pendingVerification = await storage.getApplicationsByStatus("level4_verification");
      const completedApps = await storage.getApplicationsByStatus("completed");
      const allCompleted = [...pendingVerification, ...completedApps];
      const completedTotal = allCompleted.filter(a => a.level3CompletedBy === req.session.userId).length;
      
      res.json({ waiting, inProgress, completedTotal });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Level 3's completed applications (for their completed tab)
  app.get("/api/agent/my-completed", requireAuth, requireLevel(3), async (req, res) => {
    try {
      // Get all apps completed by this agent (pending verification + fully completed)
      const pendingVerification = await storage.getApplicationsByStatus("level4_verification");
      const completedApps = await storage.getApplicationsByStatus("completed");
      const allCompleted = [...pendingVerification, ...completedApps];
      const myCompleted = allCompleted.filter(a => a.level3CompletedBy === req.session.userId);
      res.json(myCompleted);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 3: Claim an application
  app.post("/api/agent/work-queue/:id/claim", requireAuth, requireLevel(3), async (req, res) => {
    try {
      const app = await storage.getApplication(req.params.id);
      if (!app) {
        res.status(404).json({ message: "Application not found" });
        return;
      }
      if (app.status !== "level3_work") {
        res.status(400).json({ message: "Application is not in Level 3 work queue" });
        return;
      }
      if (app.assignedAgentId) {
        res.status(400).json({ message: "Application already claimed by another agent" });
        return;
      }
      const updated = await storage.updateApplication(req.params.id, {
        assignedAgentId: req.session.userId,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 3: Complete work and send to Level 4 for verification
  app.post("/api/agent/work-queue/:id/complete", requireAuth, requireLevel(3), async (req, res) => {
    try {
      const { notes } = req.body;
      const app = await storage.getApplication(req.params.id);
      if (!app) {
        res.status(404).json({ message: "Application not found" });
        return;
      }
      if (app.assignedAgentId !== req.session.userId) {
        res.status(403).json({ message: "This application is not assigned to you" });
        return;
      }
      const updated = await storage.updateApplication(req.params.id, {
        status: "level4_verification",
        currentLevel: 4,
        level3Notes: notes,
        level3CompletedAt: new Date(),
        level3CompletedBy: req.session.userId,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // LEVEL 4 (ADMIN) VERIFICATION QUEUE ROUTES
  // ===========================================================================

  // Get Level 4 verification queue
  app.get("/api/admin/verification-queue", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const applications = await storage.getApplicationsByStatus("level4_verification");
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Level 4 verification queue stats
  app.get("/api/admin/verification-queue/stats", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const pendingApps = await storage.getApplicationsByStatus("level4_verification");
      const pending = pendingApps.length;
      
      // Get today's verifications
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const completedApps = await storage.getApplicationsByStatus("completed");
      const completedToday = completedApps.filter(a => 
        a.level4VerifiedBy === req.session.userId && 
        a.level4VerifiedAt && new Date(a.level4VerifiedAt) >= today
      ).length;
      
      res.json({ pending, completedToday });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 4: Verify and complete an application
  app.post("/api/admin/verification-queue/:id/verify", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const { notes, approved } = req.body;
      const app = await storage.getApplication(req.params.id);
      if (!app) {
        res.status(404).json({ message: "Application not found" });
        return;
      }
      if (app.status !== "level4_verification") {
        res.status(400).json({ message: "Application is not pending verification" });
        return;
      }
      
      if (approved) {
        const updated = await storage.updateApplication(req.params.id, {
          status: "completed",
          currentLevel: 5,
          level4Notes: notes,
          level4VerifiedAt: new Date(),
          level4VerifiedBy: req.session.userId,
          approvedAt: new Date(),
          approvedBy: req.session.userId,
          completedAt: new Date(),
        });
        res.json(updated);
      } else {
        // Send back to Level 3 for rework
        const updated = await storage.updateApplication(req.params.id, {
          status: "level3_work",
          currentLevel: 3,
          level4Notes: notes,
          assignedAgentId: app.assignedAgentId, // Keep same agent
        });
        res.json(updated);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // ADMIN ROUTES
  // ===========================================================================

  app.get("/api/admin/users", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map((u) => ({ ...u, passwordHash: undefined })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/applications", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const applications = await storage.getAllApplications();
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/payments", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/commissions", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const commissions = await storage.getAllCommissions();
      res.json(commissions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // OWNER ROUTES (Site Configuration)
  // ===========================================================================

  app.put("/api/owner/config", requireAuth, requireLevel(5), async (req, res) => {
    try {
      const {
        siteName,
        tagline,
        description,
        logoUrl,
        faviconUrl,
        primaryColor,
        secondaryColor,
        accentColor,
        heroTitle,
        heroSubtitle,
        heroBackgroundUrl,
        heroMediaUrl,
        heroButtonText,
        heroButtonLink,
        heroSecondaryButtonText,
        heroSecondaryButtonLink,
        footerQuickLinks,
        footerLegalLinks,
        footerText,
        contactEmail,
        contactPhone,
        address,
        level1Name,
        level2Name,
        level3Name,
        level4Name,
        level5Name,
        galleryImages: rawGalleryImages,
      } = req.body;

      const galleryImages = Array.isArray(rawGalleryImages)
        ? rawGalleryImages.filter((item: unknown) => typeof item === 'string' && item.length > 0)
        : undefined;

      const config = await storage.updateSiteConfig({
        siteName,
        tagline,
        description,
        logoUrl,
        faviconUrl,
        primaryColor,
        secondaryColor,
        accentColor,
        heroTitle,
        heroSubtitle,
        heroBackgroundUrl,
        heroMediaUrl,
        heroButtonText,
        heroButtonLink,
        heroSecondaryButtonText,
        heroSecondaryButtonLink,
        footerQuickLinks,
        footerLegalLinks,
        footerText,
        contactEmail,
        contactPhone,
        address,
        level1Name,
        level2Name,
        level3Name,
        level4Name,
        level5Name,
        galleryImages,
      });

      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Package management for owner/admin
  app.post("/api/admin/packages", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const pkg = await storage.createPackage(req.body);
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/packages/:id", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const pkg = await storage.updatePackage(req.params.id, req.body);
      if (!pkg) {
        res.status(404).json({ message: "Package not found" });
        return;
      }
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/packages/:id", requireAuth, requireLevel(5), async (req, res) => {
    try {
      const success = await storage.deletePackage(req.params.id);
      if (!success) {
        res.status(404).json({ message: "Package not found" });
        return;
      }
      res.json({ message: "Package deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // SHARED USER PROFILE ENDPOINTS (Level 3+)
  // ============================================================================

  // Get user applications (for profile modal)
  app.get("/api/users/:id/applications", requireAuth, requireLevel(3), async (req, res) => {
    try {
      const apps = await storage.getApplicationsByUser(req.params.id);
      const packages = await storage.getActivePackages();
      const packagesMap = new Map(packages.map(p => [p.id, p]));
      
      const appsWithPackages = apps.map(app => ({
        ...app,
        package: app.packageId ? packagesMap.get(app.packageId) : undefined,
      }));
      
      res.json(appsWithPackages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user basic info (for edit tracking display)
  app.get("/api/users/:id/info", requireAuth, requireLevel(3), async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.json({ firstName: user.firstName, lastName: user.lastName });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update user profile with edit tracking (Level 3+)
  app.put("/api/users/:id/profile", requireAuth, requireLevel(3), async (req, res) => {
    try {
      const { userLevel, isActive, firstName, lastName, email, phone, dateOfBirth, address, city, state, zipCode } = req.body;
      const updates: Record<string, any> = {
        lastEditedBy: req.session.userId,
        lastEditedAt: new Date(),
      };
      
      // Level 3 can only edit profile data, not level/status
      const currentUserLevel = (await storage.getUser(req.session.userId!))?.userLevel || 1;
      
      if (currentUserLevel >= 4) {
        if (userLevel !== undefined) updates.userLevel = userLevel;
        if (isActive !== undefined) updates.isActive = isActive;
      }
      
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
      if (address !== undefined) updates.address = address;
      if (city !== undefined) updates.city = city;
      if (state !== undefined) updates.state = state;
      if (zipCode !== undefined) updates.zipCode = zipCode;
      
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.json({ ...user, passwordHash: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user notes
  app.get("/api/users/:id/notes", requireAuth, requireLevel(3), async (req, res) => {
    try {
      const notes = await storage.getUserNotes(req.params.id);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Add user note
  app.post("/api/users/:id/notes", requireAuth, requireLevel(3), async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || !content.trim()) {
        res.status(400).json({ message: "Note content is required" });
        return;
      }
      const note = await storage.createUserNote({
        userId: req.params.id,
        authorId: req.session.userId!,
        content: content.trim(),
      });
      res.json(note);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User management
  app.put("/api/admin/users/:id", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const { userLevel, isActive, firstName, lastName, email, phone, dateOfBirth, address, city, state, zipCode } = req.body;
      const updates: Record<string, any> = {};
      if (userLevel !== undefined) updates.userLevel = userLevel;
      if (isActive !== undefined) updates.isActive = isActive;
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
      if (address !== undefined) updates.address = address;
      if (city !== undefined) updates.city = city;
      if (state !== undefined) updates.state = state;
      if (zipCode !== undefined) updates.zipCode = zipCode;
      
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.json({ ...user, passwordHash: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get a user's applications/purchases (for profile modal)
  app.get("/api/admin/users/:id/applications", requireAuth, requireLevel(4), async (req, res) => {
    try {
      const apps = await storage.getApplicationsByUser(req.params.id);
      const packages = await storage.getActivePackages();
      const packagesMap = new Map(packages.map(p => [p.id, p]));
      
      const appsWithPackages = apps.map(app => ({
        ...app,
        package: app.packageId ? packagesMap.get(app.packageId) : undefined,
      }));
      
      res.json(appsWithPackages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
