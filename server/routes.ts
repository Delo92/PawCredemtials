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
import { firebaseStorage, firebaseAuth, getAdminAuth } from "./firebase-admin";

const memoryUpload = multer({
  storage: multer.memoryStorage(),
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

declare module "express-session" {
  interface SessionData {
    userId: string;
    userLevel: number;
    firebaseUid: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        userLevel: number;
        email: string;
        firebaseUid: string;
      };
    }
  }
}

const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await getAdminAuth().verifyIdToken(idToken);

      let user = await storage.getUserByFirebaseUid(decodedToken.uid);

      if (!user && decodedToken.email) {
        user = await storage.getUserByEmail(decodedToken.email);
        if (user) {
          await storage.updateUser(user.id, { firebaseUid: decodedToken.uid });
          user = (await storage.getUser(user.id))!;
        }
      }

      if (user) {
        req.user = {
          id: user.id,
          username: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userLevel: user.userLevel,
          email: user.email,
          firebaseUid: decodedToken.uid,
        };
        req.session.userId = user.id;
        req.session.userLevel = user.userLevel;
        req.session.firebaseUid = decodedToken.uid;
        return next();
      }
    }

    if (req.session.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.user = {
          id: user.id,
          username: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userLevel: user.userLevel,
          email: user.email,
          firebaseUid: user.firebaseUid || user.id,
        };
        return next();
      }
    }

    res.status(401).json({ message: "Unauthorized - Firebase ID token required" });
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ message: "Unauthorized - Firebase authentication failed" });
  }
};

const requireAuth = isAuthenticated;

function requireLevel(minLevel: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await isAuthenticated(req, res, () => {
      if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      if (req.user.userLevel < minLevel) {
        res.status(403).json({ message: "Forbidden - Insufficient permissions" });
        return;
      }
      next();
    });
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

  // ===========================================================================
  // FILE UPLOAD ROUTES (Firebase Storage)
  // ===========================================================================

  app.post("/api/upload/gallery", requireAuth, requireLevel(5), (req, res, next) => {
    memoryUpload.single("image")(req, res, async (err) => {
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

      try {
        const bucket = firebaseStorage.bucket();
        const uniqueSuffix = Date.now() + "-" + randomBytes(4).toString("hex");
        const ext = req.file.originalname ? "." + req.file.originalname.split(".").pop() : ".jpg";
        const fileName = `gallery/gallery-${uniqueSuffix}${ext}`;
        const file = bucket.file(fileName);

        await file.save(req.file.buffer, {
          metadata: {
            contentType: req.file.mimetype,
          },
        });

        await file.makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        res.json({ url });
      } catch (error: any) {
        console.error("Firebase Storage upload error:", error);
        res.status(500).json({ message: "Failed to upload image" });
      }
    });
  });

  // ===========================================================================
  // AUTH ROUTES
  // ===========================================================================

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, referralCode, firebaseUid } = req.body;

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

      const user = await storage.createUser({
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
          password: undefined,
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

      const decodedToken = await firebaseAuth.verifyIdToken(idToken);
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
          details: { method: "google" } as any,
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
        details: { method: "google" } as any,
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
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await getAdminAuth().verifyIdToken(idToken);

        let user = await storage.getUserByFirebaseUid(decodedToken.uid);
        if (!user && decodedToken.email) {
          user = await storage.getUserByEmail(decodedToken.email);
          if (user) {
            await storage.updateUser(user.id, { firebaseUid: decodedToken.uid });
            user = (await storage.getUser(user.id))!;
          }
        }

        if (user) {
          req.session.userId = user.id;
          req.session.userLevel = user.userLevel;
          req.session.firebaseUid = decodedToken.uid;
          res.json({ user: { ...user, passwordHash: undefined } });
          return;
        }
      }

      if (req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          res.json({ user: { ...user, passwordHash: undefined } });
          return;
        }
      }

      res.status(401).json({ message: "Not authenticated" });
    } catch (error) {
      res.status(401).json({ message: "Not authenticated" });
    }
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
      const applications = await storage.getApplicationsByUser(req.user!.id);
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/applications/:id", requireAuth, async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id as string);
      if (!application) {
        res.status(404).json({ message: "Application not found" });
        return;
      }
      // Check ownership or admin access
      if (application.userId !== req.user!.id && req.user!.userLevel < 4) {
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
        userId: req.user!.id,
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
      const alreadyInQueue = existing.find(e => e.applicantId === req.user!.id && e.status === "waiting");
      if (alreadyInQueue) {
        res.status(400).json({ message: "You are already in the queue", queueEntry: alreadyInQueue });
        return;
      }

      // Get user info for denormalized fields
      const user = await storage.getUser(req.user!.id);
      let pkg = null;
      if (packageId) {
        pkg = await storage.getPackage(packageId);
      }

      const position = existing.length + 1;

      const entry = await storage.createQueueEntry({
        applicantId: req.user!.id,
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
      const myEntry = entries.find(e => e.applicantId === req.user!.id);
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
      const myEntry = entries.find(e => e.applicantId === req.user!.id && e.status === "waiting");
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
      const entry = await storage.getQueueEntry(req.params.id as string);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.status !== "waiting") {
        res.status(400).json({ message: "This caller has already been claimed" });
        return;
      }
      const updated = await storage.updateQueueEntry(req.params.id as string, {
        reviewerId: req.user!.id,
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
      const entry = await storage.getQueueEntry(req.params.id as string);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.reviewerId !== req.user!.id) {
        res.status(403).json({ message: "This caller is not assigned to you" });
        return;
      }
      
      // Here is where Twilio/GHL integration would generate a call
      // For now, just update status
      const updated = await storage.updateQueueEntry(req.params.id as string, {
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
      const entry = await storage.getQueueEntry(req.params.id as string);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.reviewerId !== req.user!.id) {
        res.status(403).json({ message: "This caller is not assigned to you" });
        return;
      }
      const updated = await storage.updateQueueEntry(req.params.id as string, {
        status: "completed",
        callEndedAt: new Date(),
        completedAt: new Date(),
        notes,
        outcome,
      });
      
      if (entry.applicationId) {
        if (outcome === "approved") {
          await storage.updateApplication(entry.applicationId, {
            status: "level3_work",
            currentLevel: 3,
            level2Notes: notes,
            level2ApprovedAt: new Date(),
            level2ApprovedBy: req.user!.id,
            assignedReviewerId: req.user!.id,
          });
        } else if (outcome === "denied") {
          await storage.updateApplication(entry.applicationId, {
            status: "level2_denied",
            currentLevel: 2,
            level2Notes: notes,
            rejectedAt: new Date(),
            rejectedBy: req.user!.id,
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
      const entry = await storage.getQueueEntry(req.params.id as string);
      if (!entry) {
        res.status(404).json({ message: "Queue entry not found" });
        return;
      }
      if (entry.reviewerId !== req.user!.id) {
        res.status(403).json({ message: "This caller is not assigned to you" });
        return;
      }
      const updated = await storage.updateQueueEntry(req.params.id as string, {
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
      if (req.user!.userLevel >= 4) {
        const commissions = await storage.getAllCommissions();
        res.json(commissions);
      } else {
        const commissions = await storage.getCommissionsByAgent(req.user!.id);
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
      const inProgress = allApps.filter(a => a.assignedAgentId === req.user!.id).length;
      
      const pendingVerification = await storage.getApplicationsByStatus("level4_verification");
      const completedApps = await storage.getApplicationsByStatus("completed");
      const allCompleted = [...pendingVerification, ...completedApps];
      const completedTotal = allCompleted.filter(a => a.level3CompletedBy === req.user!.id).length;
      
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
      const myCompleted = allCompleted.filter(a => a.level3CompletedBy === req.user!.id);
      res.json(myCompleted);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Level 3: Claim an application
  app.post("/api/agent/work-queue/:id/claim", requireAuth, requireLevel(3), async (req, res) => {
    try {
      const app = await storage.getApplication(req.params.id as string);
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
      const updated = await storage.updateApplication(req.params.id as string, {
        assignedAgentId: req.user!.id,
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
      const app = await storage.getApplication(req.params.id as string);
      if (!app) {
        res.status(404).json({ message: "Application not found" });
        return;
      }
      if (app.assignedAgentId !== req.user!.id) {
        res.status(403).json({ message: "This application is not assigned to you" });
        return;
      }
      const updated = await storage.updateApplication(req.params.id as string, {
        status: "level4_verification",
        currentLevel: 4,
        level3Notes: notes,
        level3CompletedAt: new Date(),
        level3CompletedBy: req.user!.id,
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
        a.level4VerifiedBy === req.user!.id && 
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
      const app = await storage.getApplication(req.params.id as string);
      if (!app) {
        res.status(404).json({ message: "Application not found" });
        return;
      }
      if (app.status !== "level4_verification") {
        res.status(400).json({ message: "Application is not pending verification" });
        return;
      }
      
      if (approved) {
        const updated = await storage.updateApplication(req.params.id as string, {
          status: "completed",
          currentLevel: 5,
          level4Notes: notes,
          level4VerifiedAt: new Date(),
          level4VerifiedBy: req.user!.id,
          approvedAt: new Date(),
          approvedBy: req.user!.id,
          completedAt: new Date(),
        });
        res.json(updated);
      } else {
        // Send back to Level 3 for rework
        const updated = await storage.updateApplication(req.params.id as string, {
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
      const pkg = await storage.updatePackage(req.params.id as string, req.body);
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
      const success = await storage.deletePackage(req.params.id as string);
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
      const apps = await storage.getApplicationsByUser(req.params.id as string);
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
      const user = await storage.getUser(req.params.id as string);
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
        lastEditedBy: req.user!.id,
        lastEditedAt: new Date(),
      };
      
      // Level 3 can only edit profile data, not level/status
      const currentUserLevel = req.user!.userLevel;
      
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
      
      const user = await storage.updateUser(req.params.id as string, updates);
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
      const notes = await storage.getUserNotes(req.params.id as string);
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
        userId: req.params.id as string,
        authorId: req.user!.id,
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
      
      const user = await storage.updateUser(req.params.id as string, updates);
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
      const apps = await storage.getApplicationsByUser(req.params.id as string);
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

  // ===========================================================================
  // FIREBASE INITIALIZATION / SEED ENDPOINT
  // ===========================================================================

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

      // 1. Initialize _counters collection (ChronicDocs pattern)
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
        results.siteConfig = "already_exists";
      }

      // 3. Admin settings (ChronicDocs pattern)
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

      // 4. Commission settings (ChronicDocs pattern)
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
            name: "Basic Doctor's Note",
            description: "Standard doctor's note for work or school absence. Includes date of visit and return-to-work date.",
            price: 4999,
            isActive: true,
            requiresLevel2: false,
            features: ["Same-day delivery", "Digital copy", "Verification number"],
            category: "standard",
          },
          {
            name: "Urgent Care Note",
            description: "Urgent care visit documentation with detailed medical excuse. Suitable for extended absences.",
            price: 7999,
            isActive: true,
            requiresLevel2: true,
            features: ["Priority processing", "Medical consultation", "Detailed documentation", "Print-ready PDF"],
            category: "urgent",
          },
          {
            name: "Specialist Referral Note",
            description: "Specialist referral documentation with medical justification. Includes follow-up recommendations.",
            price: 12999,
            isActive: true,
            requiresLevel2: true,
            features: ["Specialist consultation", "Comprehensive documentation", "Follow-up plan", "Priority support"],
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

      // 6. Test accounts for all 5 levels (ChronicDocs pattern)
      const testPassword = "TestPass123";
      const hashedTestPassword = await bcrypt.hash(testPassword, 10);
      const testAccounts = [
        { email: "level1@test.com", firstName: "Test", lastName: "Applicant", userLevel: 1, referralCode: "TEST_L1" },
        { email: "level2@test.com", firstName: "Test", lastName: "Reviewer", userLevel: 2, referralCode: "TEST_L2" },
        { email: "level3@test.com", firstName: "Test", lastName: "Agent", userLevel: 3, referralCode: "TEST_L3" },
        { email: "level4@test.com", firstName: "Test", lastName: "Admin", userLevel: 4, referralCode: "TEST_L4" },
        { email: "level5@test.com", firstName: "Test", lastName: "Owner", userLevel: 5, referralCode: "TEST_L5" },
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

      // Also ensure owner@doctorsnote.com exists as Level 5
      const allUsers = await storage.getAllUsers();
      const hasOwner = allUsers.some((u: any) => u.userLevel === 5 && u.email === "owner@doctorsnote.com");
      if (!hasOwner) {
        try {
          const ownerEmail = req.body?.email || "owner@doctorsnote.com";
          const ownerPassword = req.body?.password || testPassword;
          const hashedOwnerPw = await bcrypt.hash(ownerPassword, 10);
          await storage.createUser({
            email: ownerEmail,
            passwordHash: hashedOwnerPw,
            firstName: "Platform",
            lastName: "Owner",
            userLevel: 5,
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

      // 7. Initialize remaining collections with placeholder docs using proper storage methods
      // ChronicDocs pattern: all collections exist in Firestore from the start
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
        () => storage.createFormType({ name: "Medical Note", description: "Standard medical documentation form", isActive: true })
      );
      await initCollection("bulletin",
        () => storage.getBulletins(),
        () => storage.createBulletin({ title: "Welcome", message: "Platform is live and ready.", isActive: true, priority: "normal", targetLevels: [1, 2, 3, 4, 5] })
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
        () => storage.createBlogPost({ title: "Welcome to Our Platform", content: "We are excited to launch our doctor's note service.", isPublished: true, authorId: "system" })
      );

      // 8. Initialize ALL remaining collections with placeholder docs so they appear in Firestore
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
        message: "Firebase seed complete - all ChronicDocs collections initialized",
        details: results,
      });
    } catch (error: any) {
      console.error("Seed error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===========================================================================
  // DATA MIGRATION ENDPOINT (PostgreSQL + Local Files -> Firebase)
  // ===========================================================================

  app.post("/api/admin/migrate-to-firebase", requireAuth, requireLevel(5), async (req, res) => {
    try {
      const results: Record<string, any> = { images: 0, errors: [] as string[] };

      const config = await storage.getSiteConfig();
      if (config && config.galleryImages && Array.isArray(config.galleryImages)) {
        const newUrls: string[] = [];
        for (const imageUrl of config.galleryImages) {
          if (imageUrl.startsWith("/uploads/gallery/")) {
            const localPath = path.join(process.cwd(), imageUrl);
            if (fs.existsSync(localPath)) {
              try {
                const fileBuffer = fs.readFileSync(localPath);
                const fileName = `gallery/${path.basename(localPath)}`;
                const bucket = firebaseStorage.bucket();
                const file = bucket.file(fileName);
                const ext = path.extname(localPath).toLowerCase();
                const mimeMap: Record<string, string> = {
                  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                  ".png": "image/png", ".gif": "image/gif",
                  ".webp": "image/webp", ".svg": "image/svg+xml",
                };
                await file.save(fileBuffer, {
                  metadata: { contentType: mimeMap[ext] || "image/jpeg" },
                });
                await file.makePublic();
                const firebaseUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                newUrls.push(firebaseUrl);
                results.images++;
              } catch (e: any) {
                (results.errors as string[]).push(`Failed to migrate ${imageUrl}: ${e.message}`);
                newUrls.push(imageUrl);
              }
            } else {
              newUrls.push(imageUrl);
            }
          } else {
            newUrls.push(imageUrl);
          }
        }

        if (results.images > 0) {
          await storage.updateSiteConfig({ galleryImages: newUrls } as any);
        }
      }

      res.json({
        success: true,
        message: `Migration complete. ${results.images} images migrated to Firebase Storage.`,
        details: results,
      });
    } catch (error: any) {
      console.error("Migration error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
